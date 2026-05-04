const partListContainer = document.getElementById('partListContainer') as HTMLDivElement;
const totalPartsSpan = document.getElementById('totalParts') as HTMLSpanElement;
const totalMappingsSpan = document.getElementById('totalMappings') as HTMLSpanElement;
const totalPlacedSpan = document.getElementById('totalPlaced') as HTMLSpanElement;
const btnExtract = document.getElementById('btnExtract') as HTMLButtonElement;
const btnPlace = document.getElementById('btnPlace') as HTMLButtonElement;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;

// 定义引脚网络映射结构
interface PinNetMap {
	[pinNum: string]: { net: string; placed: boolean; hasOtherNet: boolean };
}

// 定义元件引脚列表结构
interface CompPinListItem {
	designator: string;
	pinNetMap: PinNetMap;
}

// 定义 compPinList 的结构，键为 uniqueId
type CompPinList = Record<string, CompPinListItem>;

// 若使用API库的会在调用时显示未定义
export const EPCB_MouseEventType = {
	SELECTED: 'selected' as EPCB_MouseEventType,
	CLEAR_SELECTED: 'clearSelected' as EPCB_MouseEventType,
	MOVE: 'move' as EPCB_MouseEventType,
} as const;

let compPinList: CompPinList = {};

function showToastMessage(msg: string, type = ESYS_ToastMessageType.INFO, timer = 5) {
	eda.sys_Message.showToastMessage(`设置端口到引脚: ${msg}`, type, timer);
}

const debGetNetFromPart = debounceAsync(getNetFromPart);
const debSetNetToPin = debounceAsync(setNetToPin);

// ==================== 按钮事件 ====================
btnExtract.addEventListener('click', async () => {
	// 获取当前文档信息
	const currentDocInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	// 增加非空判断，防止对象为 undefined
	if (!currentDocInfo || currentDocInfo.documentType !== EDMT_EditorDocumentType.PCB) {
		showToastMessage('请在PCB中使用提取');
		return;
	}

	eda.pcb_Event.addMouseEventListener('setNetToPinPCB', EPCB_MouseEventType.SELECTED, async () => {
		let uncancelled = true;
		try {
			btnExtract.disabled = true;
			await debGetNetFromPart();
		}
		catch (e: any) {
			if (e?.message === 'Debounced cancelled') {
				console.log('debounceAsync getNetFromPart');
				uncancelled = false;
			}
			else {
				console.error(e);
				eda.sys_Log.add(String(e), ESYS_LogType.ERROR);
				showToastMessage('提取失败, 错误详情请查看日志', ESYS_ToastMessageType.ERROR);
			}
		}
		finally {
			if (uncancelled) {
				renderList();
				btnExtract.disabled = false;
			}
		}
	}, true);
	showToastMessage('请点击元件提取引脚信息');
});

btnPlace.addEventListener('click', async () => {
	const currentDocInfo = await eda.dmt_SelectControl.getCurrentDocumentInfo();
	if (!currentDocInfo || currentDocInfo.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
		showToastMessage('请在原理图图页中使用放置');
		return;
	}

	if (Object.keys(compPinList).length === 0) {
		showToastMessage('暂无可用元件引脚列表,请先提取元件引脚信息');
		return;
	}

	eda.sch_Event.addMouseEventListener('setNetToPinSCH', ESCH_MouseEventType.SELECTED, async () => {
		let uncancelled = true;
		try {
			btnPlace.disabled = true;
			await debSetNetToPin();
		}
		catch (e: any) {
			if (e?.message === 'Debounced cancelled') {
				console.log('debounceAsync setNetToPin');
				uncancelled = false;
			}
			else {
				console.error(e);
				eda.sys_Log.add(String(e), ESYS_LogType.ERROR);
				showToastMessage('放置失败, 错误详情请查看日志', ESYS_ToastMessageType.ERROR);
			}
		}
		finally {
			if (uncancelled) {
				renderList();
				btnPlace.disabled = false;
			}
		}
	}, true);
	showToastMessage('请选择放置网络端口的元件');
});

btnClear.addEventListener('click', () => {
	compPinList = {};
	if (eda.sch_Event.isEventListenerAlreadyExist('setNetToPinSCH')) {
		const result = eda.sch_Event.removeEventListener('setNetToPinSCH');
		console.log('removeEventListener sch', result);
	}
	if (eda.pcb_Event.isEventListenerAlreadyExist('setNetToPinPCB')) {
		const result = eda.pcb_Event.removeEventListener('setNetToPinPCB');
		console.log('removeEventListener pcb', result);
	}
	renderList();
});

async function getNetFromPart() {
	const items = await eda.pcb_SelectControl.getAllSelectedPrimitives();
	console.log('btnExtract items', items);
	for (const item of items) {
		if (item.getState_PrimitiveType() !== EPCB_PrimitiveType.COMPONENT) {
			showToastMessage('请重新点击提取并选择元件');
			continue;
		}
		const comp = await eda.pcb_PrimitiveComponent.get(item.getState_PrimitiveId());
		if (!comp) {
			showToastMessage(`获取获取元件信息失败, 元件图元ID:${item.getState_PrimitiveId()}`, ESYS_ToastMessageType.WARNING);
			continue;
		}
		const uniqueId = comp.getState_UniqueId();
		const designator = comp.getState_Designator() ?? '无位号';
		if (!uniqueId) {
			showToastMessage(`元件无唯一ID, 请先分配唯一ID, 元件:${designator}`);
			continue;
		}

		const compPinListItem: CompPinListItem = {
			designator: comp.getState_Designator() ?? '',
			pinNetMap: {},
		};
		const pads = comp.getState_Pads();
		if (!pads) {
			showToastMessage(`提取元件引脚信息失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING);
			continue;
		}
		pads.forEach((pad: { primitiveId: string; net: string; padNumber: string }) => {
			compPinListItem.pinNetMap[pad.padNumber] = { net: pad.net, placed: false, hasOtherNet: false };
		});
		compPinList[uniqueId] = compPinListItem;
		showToastMessage(`提取元件引脚信息成功, 元件:${designator}`, ESYS_ToastMessageType.SUCCESS);
	}
}

async function setNetToPin(): Promise<void> {
	const itemsId = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
	console.log('setNetToPin itemsId', itemsId);
	if (!itemsId?.length) {
		return;
	}

	let netlistComps;

	for (const id of itemsId) {
		const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
		if (type !== ESCH_PrimitiveType.COMPONENT) {
			showToastMessage('请重新点击提取并选择元件');
			continue;
		}
		const comp = await eda.sch_PrimitiveComponent.get(id);
		if (!comp) {
			showToastMessage(`获取获取元件信息失败, 元件图元ID:${id}`, ESYS_ToastMessageType.WARNING);
			continue;
		}
		if (comp.getState_ComponentType() !== ESCH_PrimitiveComponentType.COMPONENT) {
			showToastMessage('请重新点击提取并选择元件');
			continue;
		}

		const uniqueId = comp.getState_UniqueId();
		const designator = comp.getState_Designator() ?? '无位号';
		if (!uniqueId) {
			showToastMessage(`元件无唯一ID, 请先分配唯一ID, 元件:${designator}`);
			continue;
		}

		const pinNetMap = compPinList[uniqueId]?.pinNetMap;
		if (!pinNetMap) {
			showToastMessage(`当前可用引脚列表中无此元件, 元件:${designator}`);
			continue;
		}

		const allPin = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(comp.getState_PrimitiveId());
		if (!allPin) {
			showToastMessage(`获取元件引脚列表失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING);
			continue;
		}

		if (!netlistComps) {
			const netlistBlob = await eda.sch_ManufactureData.getNetlistFile('', ESYS_NetlistType.JLCEDA_PRO);
			if (!netlistBlob) {
				showToastMessage('获取网表文件失败', ESYS_ToastMessageType.WARNING);
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
				showToastMessage('解析网表失败', ESYS_ToastMessageType.WARNING);
				return;
			}

			console.log('setNetToPin netlistComps', netlistComps);
		}

		const netlistCompInfo = netlistComps[uniqueId];
		const netlistPinMap = netlistCompInfo?.pinInfoMap;
		if (!netlistPinMap) {
			showToastMessage(`获取元件引脚的网络信息失败, 元件:${designator}`, ESYS_ToastMessageType.WARNING);
			continue;
		}

		for (const pin of allPin) {
			// console.log('setNetToPin pin', pin, netlistPinMap[pin.getState_PinNumber()]?.net);

			const currentNet = netlistPinMap[pin.getState_PinNumber()]?.net;
			const targetPinInfo = pinNetMap[pin.getState_PinNumber()];

			if (currentNet !== '') {
				if (currentNet === targetPinInfo.net) {
					targetPinInfo.placed = true;
				}
				else {
					targetPinInfo.hasOtherNet = true;
				}
				continue;
			}
			if (!targetPinInfo.net)
				continue;

			let x1 = pin.getState_X();
			let y1 = pin.getState_Y();
			const direction = Math.round((pin.getState_Rotation() / 90) % 4);
			switch (true) {
				case (direction >= 0 && direction < 1):
					x1 += 10;
					break;
				case (direction >= 1 && direction < 2):
					y1 += 10;
					break;
				case (direction >= 2 && direction < 3):
					x1 -= 10;
					break;
				case (direction >= 3 && direction < 4):
					y1 -= 10;
					break;
			}
			const netPort = await eda.sch_PrimitiveComponent.createNetPort('IN', targetPinInfo.net, x1, y1, 180 - pin.getState_Rotation(), false);
			const wire = await eda.sch_PrimitiveWire.create([x1, y1, pin.getState_X(), pin.getState_Y()]);
			console.log('setNetToPin netPort,wire', netPort, wire);
			if (netPort && wire) {
				targetPinInfo.placed = true;
			}
			else {
				showToastMessage(`创建端口或导线失败,元件-引脚:${designator}-${pin.getState_PinNumber()}`, ESYS_ToastMessageType.WARNING);
			}
		}
	}
}

// ==================== 辅助计算 ====================
function getTotalCount(): [number, number] {
	let placedCount = 0;
	let mappingCount = 0;
	Object.values(compPinList).forEach(m => Object.values(m.pinNetMap).forEach((e) => {
		mappingCount++;
		if (e.placed)
			placedCount++;
	}));
	return [mappingCount, placedCount];
}

// ==================== UI渲染 ====================
function renderStats(): void {
	const [mappingCount, placedCount] = getTotalCount();
	totalMappingsSpan.textContent = String(mappingCount);
	totalPlacedSpan.textContent = String(placedCount);
	totalPartsSpan.textContent = String(Object.keys(compPinList).length);
}

function renderList(): void {
	if (!partListContainer)
		return;
	console.log('renderList compPinList', compPinList);
	partListContainer.innerHTML = '';

	if (Object.keys(compPinList).length === 0) {
		const noData = document.createElement('div');
		noData.className = 'no-data';
		noData.textContent = '暂无数据，请点击“提取”';
		partListContainer.appendChild(noData);
		renderStats();
		return;
	}

	for (const [uniqueId, listItem] of Object.entries(compPinList)) {
		const card = document.createElement('div');
		card.className = 'part-card';
		// 默认折叠
		const header = document.createElement('div');
		header.className = 'part-header';

		const pinMappings = listItem.pinNetMap;
		const placedCount = Object.values(pinMappings).filter(m => m.placed).length;
		const totalCount = Object.values(pinMappings).length;

		header.innerHTML = `
            <div class="part-name">
                <span class="collapse-icon">▶</span> ${listItem.designator}(${uniqueId})
            </div>
            <div class="part-summary">
                <span>${totalCount} 引脚</span>
                <span class="placed-count">${placedCount} 已放置</span>
            </div>
        `;

		const pinList = document.createElement('div');
		pinList.className = 'pin-list';

		for (const [pinNumber, pinInfo] of Object.entries(pinMappings)) {
			const item = document.createElement('div');
			item.className = 'pin-item';
			let stateTex = '未放置';
			if (pinInfo.hasOtherNet) {
				item.classList.add('has-other');
				stateTex = '已有网络';
			}
			else if (pinInfo.placed) {
				item.classList.add('placed');
				stateTex = '已放置';
			}

			item.innerHTML = `
                <span class="pin-pin">${pinNumber}</span>
                <span class="pin-arrow">→</span>
                <span class="pin-net">${pinInfo.net}</span>
                <span class="pin-status">${stateTex}</span>
            `;
			pinList.appendChild(item);
		}

		// 点击器件头切换展开/折叠
		header.addEventListener('click', () => {
			card.classList.toggle('expanded');
		});

		card.appendChild(header);
		card.appendChild(pinList);
		partListContainer.appendChild(card);
	}

	renderStats();
}

function debounceAsync<T extends (...args: any[]) => any>(fn: T, duration = 100): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	let timerId: ReturnType<typeof setTimeout> | null = null;
	let rejectPrevious: ((reason?: any) => void) | null = null; // 可选：取消之前未完成的Promise
	return function (this: T, ...args: Parameters<T>) {
		if (rejectPrevious)
			rejectPrevious(new Error('Debounced cancelled'));
		return new Promise((resolve, reject) => {
			rejectPrevious = reject;
			if (timerId)
				clearTimeout(timerId);
			timerId = setTimeout(() => {
				fn.call(this, ...args)
					.then(resolve)
					.catch(reject)
					.finally(() => {
						rejectPrevious = null;
					});
			}, duration);
		});
	};
}

// ==================== 初始化 ====================
function init(): void {
	compPinList = {};
	renderList();
}

init();
