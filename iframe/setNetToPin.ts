const getBtn = document.getElementById('get') as HTMLButtonElement;
const setBtn = document.getElementById('set') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel') as HTMLButtonElement;
const generatorInput = document.getElementById('generatorInput') as HTMLInputElement;
generatorInput.value = '当前可用的元件引脚列表:0';

// 定义引脚网络映射结构
interface PinNetMap {
	[pinNum: string]: string;
}

// 定义元件引脚列表结构
interface CompPinListItem {
	designator: string;
	pinNetMap: PinNetMap;
}

// 若使用API库的会在调用时显示未定义
export const EPCB_MouseEventType = {
	SELECTED: 'selected' as EPCB_MouseEventType,
	CLEAR_SELECTED: 'clearSelected' as EPCB_MouseEventType,
	MOVE: 'move' as EPCB_MouseEventType,
} as const;

// 定义 CompPinList 的结构，键为 uniqueId
let CompPinList: Record<string, CompPinListItem> = {};

getBtn.addEventListener('click', async () => {
	// 获取当前文档信息
	const currentDocInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	// 增加非空判断，防止对象为 undefined
	if (!currentDocInfo || currentDocInfo.documentType !== EDMT_EditorDocumentType.PCB) {
		eda.sys_Message.showToastMessage('请在PCB中使用提取', ESYS_ToastMessageType.INFO, 5);
		return;
	}

	generatorInput.value = '请点击元件提取引脚信息';
	eda.pcb_Event.addMouseEventListener(
		'setNetToPinPCB',
		EPCB_MouseEventType.SELECTED,
		async () => {
			const items = await eda.pcb_SelectControl.getAllSelectedPrimitives();
			console.log('getBtn items', items);
			for (const item of items) {
				if (item.getState_PrimitiveType() !== EPCB_PrimitiveType.COMPONENT) {
					eda.sys_Message.showToastMessage('请重新点击提取并选择元件', ESYS_ToastMessageType.INFO, 5);
					continue;
				}
				const comp = await eda.pcb_PrimitiveComponent.get(item.getState_PrimitiveId());
				if (!comp) {
					eda.sys_Message.showToastMessage(
						`获取获取元件信息失败, 元件图元ID:${item.getState_PrimitiveId()}`,
						ESYS_ToastMessageType.WARNING,
						5,
					);
					continue;
				}
				const uniqueId = comp.getState_UniqueId();
				const designator = comp.getState_Designator() ?? '无位号';
				if (!uniqueId) {
					eda.sys_Message.showToastMessage(`元件无唯一ID, 请先分配唯一ID, 元件:${designator}`, ESYS_ToastMessageType.INFO, 5);
					continue;
				}

				const compPinList: CompPinListItem = {
					designator: comp.getState_Designator() ?? '',
					pinNetMap: {},
				};
				const pads = comp.getState_Pads();
				if (!pads) {
					eda.sys_Message.showToastMessage(`提取元件引脚信息失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING, 5);
					continue;
				}
				// 假设 pad 有 num 和 net 属性
				pads.forEach((pad: { primitiveId: string; net: string; padNumber: string }) => {
					compPinList.pinNetMap[pad.padNumber] = pad.net;
				});
				CompPinList[uniqueId] = compPinList;
				eda.sys_Message.showToastMessage(`提取元件引脚信息成功, 元件:${designator}`, ESYS_ToastMessageType.SUCCESS, 5);
			}
			generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		},
		true,
	);
});

setBtn.addEventListener('click', async () => {
	const currentDocInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	if (!currentDocInfo || currentDocInfo.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
		eda.sys_Message.showToastMessage('请在原理图图页中使用放置', ESYS_ToastMessageType.INFO, 5);
		return;
	}
	generatorInput.value = '请选择放置网络端口的元件';
	eda.sch_Event.addMouseEventListener('setNetToPinSCH', ESCH_MouseEventType.SELECTED, setNetToPin, true);
});

cancelBtn.addEventListener('click', () => {
	CompPinList = {};
	generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
	if (eda.sch_Event.isEventListenerAlreadyExist('setNetToPinSCH')) {
		const result = eda.sch_Event.removeEventListener('setNetToPinSCH');
		console.log('removeEventListener sch', result);
	}
	if (eda.pcb_Event.isEventListenerAlreadyExist('setNetToPinPCB')) {
		const result = eda.pcb_Event.removeEventListener('setNetToPinPCB');
		console.log('removeEventListener pcb', result);
	}
});

async function setNetToPin(): Promise<void> {
	const itemsId = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
	console.log('setNetToPin itemsId', itemsId);
	if (!itemsId?.length) {
		generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		return;
	}

	if (Object.keys(CompPinList).length === 0) {
		eda.sys_Message.showToastMessage('暂无可用元件引脚列表,请先提取元件引脚信息', ESYS_ToastMessageType.INFO, 5);
		generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		return;
	}

	let netlistComps;

	for (const id of itemsId) {
		const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
		if (type !== ESCH_PrimitiveType.COMPONENT) {
			eda.sys_Message.showToastMessage('请重新点击提取并选择元件', ESYS_ToastMessageType.INFO, 5);
			continue;
		}
		const comp = await eda.sch_PrimitiveComponent.get(id);
		if (!comp) {
			eda.sys_Message.showToastMessage(`获取获取元件信息失败, 元件图元ID:${id}`, ESYS_ToastMessageType.WARNING, 5);
			continue;
		}
		if (comp.getState_ComponentType() !== ESCH_PrimitiveComponentType.COMPONENT) {
			eda.sys_Message.showToastMessage('请重新点击提取并选择元件', ESYS_ToastMessageType.INFO, 5);
			continue;
		}

		const uniqueId = comp.getState_UniqueId();
		const designator = comp.getState_Designator() ?? '无位号';
		if (!uniqueId) {
			eda.sys_Message.showToastMessage(`元件无唯一ID, 请先分配唯一ID, 元件:${designator}`, ESYS_ToastMessageType.INFO, 5);
			continue;
		}

		const pinNetMap = CompPinList[uniqueId]?.pinNetMap;
		if (!pinNetMap) {
			eda.sys_Message.showToastMessage(`当前可用引脚列表中无此元件, 元件:${designator}`, ESYS_ToastMessageType.INFO, 5);
			generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
			continue;
		}

		const allPin = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(comp.getState_PrimitiveId());
		if (!allPin) {
			eda.sys_Message.showToastMessage(`获取元件引脚列表失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING, 5);
			continue;
		}

		if (!netlistComps) {
			const netlistBlob = await eda.sch_ManufactureData.getNetlistFile('', ESYS_NetlistType.JLCEDA_PRO);
			if (!netlistBlob) {
				eda.sys_Message.showToastMessage('获取网表文件失败', ESYS_ToastMessageType.WARNING, 5);
				generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
				return;
			}
			const netlistText = await netlistBlob.text();
			let netlistData: any;
			try {
				netlistData = JSON.parse(netlistText);
				netlistComps = netlistData.components;
			}
			catch (err) {
				console.warn('prase netlist failed, error:', err);
				eda.sys_Message.showToastMessage('解析网表失败', ESYS_ToastMessageType.WARNING, 5);
				return;
			}

			console.log('setNetToPin netlistComps', netlistComps);
		}

		const netlistCompInfo = netlistComps[uniqueId];
		const netlistPinMap = netlistCompInfo?.pinInfoMap;
		if (!netlistPinMap) {
			eda.sys_Message.showToastMessage(`获取元件引脚的网络信息失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING, 5);
			continue;
		}

		for (const pin of allPin) {
			console.log('setNetToPin pin', pin, netlistPinMap[pin.getState_PinNumber()]?.net);
			// 检查网络状态
			const currentNet = netlistPinMap[pin.getState_PinNumber()]?.net;
			const targetNet = pinNetMap[pin.getState_PinNumber()];

			if (currentNet !== '' || targetNet === '')
				continue;

			let x1 = pin.getState_X();
			let y1 = pin.getState_Y();
			const direction = Math.round(pin.getState_Rotation() / 90);
			switch (direction) {
				case 0:
					x1 += 10;
					break;
				case 1:
					y1 += 10;
					break;
				case 2:
					x1 -= 10;
					break;
				case 3:
					y1 -= 10;
					break;
			}
			const netPort = await eda.sch_PrimitiveComponent.createNetPort('IN', targetNet, x1, y1, 180 - pin.getState_Rotation(), false);
			const wire = await eda.sch_PrimitiveWire.create([x1, y1, pin.getState_X(), pin.getState_Y()]);
			console.log('setNetToPin netPort,wire', netPort, wire);
		}
	}

	generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
}
