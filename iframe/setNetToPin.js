const getBtn = document.getElementById('get');
const setBtn = document.getElementById('set');
const cancelBtn = document.getElementById('cancel');
const generatorInput = document.getElementById('generatorInput');
generatorInput.value = '当前可用的元件引脚列表:0';

let CompPinList = {};

getBtn.addEventListener('click', async () => {
	if ((await eda.dmt_SelectControl.getCurrentDocumentInfo()).documentType !== EDMT_EditorDocumentType.PCB) {
		eda.sys_Message.showToastMessage('请在PCB中使用提取', 'info', 3);
		return;
	}
	generatorInput.value = '请点击元件提取引脚信息';
	eda.pcb_Event.addMouseEventListener(
		'SelectedPCB',
		'selected',
		async () => {
			const comps = await eda.pcb_SelectControl.getAllSelectedPrimitives();
			console.log('getBtn comp', comps);
			for (const comp of comps) {
				if (comp.primitiveType === 'Component') {
					const compPinList = {
						designator: comp.designator,
						pinNetMap: {},
					};
					comp.pads.forEach((pad) => {
						compPinList.pinNetMap[pad.num] = pad.net;
					});
					CompPinList[comp.uniqueId] = compPinList;
				}
				else {
					eda.sys_Message.showToastMessage('请重新点击提取并选择元件', 'info', 3);
				}
			}
			generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		},
		true,
	);
});

setBtn.addEventListener('click', async () => {
	if ((await eda.dmt_SelectControl.getCurrentDocumentInfo()).documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
		eda.sys_Message.showToastMessage('请在原理图图页中使用放置', 'info', 3);
		return;
	}
	generatorInput.value = '请选择放置网络端口的元件';
	eda.sch_Event.addMouseEventListener('SelectedSCH', 'selected', setNetToPin, true);
});

cancelBtn.addEventListener('click', () => {
	CompPinList = {};
	generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
	if (eda.sch_Event.isEventListenerAlreadyExist('SelectedSCH')) {
		const result = eda.sch_Event.removeEventListener('SelectedSCH');
		console.log('removeEventListener sch', result);
	}
	if (eda.pcb_Event.isEventListenerAlreadyExist('SelectedPCB')) {
		const result = eda.pcb_Event.removeEventListener('SelectedPCB');
		console.log('removeEventListener pcb', result);
	}
});

async function setNetToPin() {
	const comps = await eda.sch_SelectControl.getAllSelectedPrimitives();
	console.log('setNetToPin comps', comps);
	if (!comps.length) {
		generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		return;
	}

	if (Object.keys(CompPinList).length === 0) {
		eda.sys_Message.showToastMessage('暂无可用元件引脚列表,请先提取元件引脚信息', 'info', 3);
		generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
		return;
	}

	const netlistBlob = await eda.sch_ManufactureData.getNetlistFile('', 'JLCEDA');
	const netlistComps = JSON.parse(await netlistBlob.text()).components;
	console.log('setNetToPin netlistComps', netlistComps);

	for (const comp of comps) {
		const netlistCompInfo = netlistComps[comp.uniqueId];
		const netlistPinMap = netlistCompInfo?.pinInfoMap;
		if (!netlistPinMap) {
			eda.sys_Message.showToastMessage('获取选择元件引脚的网络信息失败', 'warn', 3);
			generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
			return;
		}

		const pinNetMap = CompPinList[comp.uniqueId]?.pinNetMap;
		if (!pinNetMap) {
			eda.sys_Message.showToastMessage(`当前可用引脚列表中无选中元件:${netlistPinMap?.pops?.Designator}`, 'info', 3);
			generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
			return;
		}
		const allPin = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(comp.primitiveId);

		for (const pin of allPin) {
			console.log('setNetToPin pin', pin, netlistPinMap[pin.pinNumber]?.net);
			if (netlistPinMap[pin.pinNumber]?.net !== '' || pinNetMap[pin.pinNumber] === '')
				continue;

			let x1 = pin.x;
			let y1 = pin.y;
			const direction = Math.round(pin.rotation / 90);
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
			const netPort = await eda.sch_PrimitiveComponent.createNetPort('IN', pinNetMap[pin.pinNumber], x1, y1, 180 - pin.rotation, false);
			const wire = await eda.sch_PrimitiveWire.create([x1, y1, pin.x, pin.y]);
			console.log('setNetToPin netPort,wire', netPort, wire);
		}
	}

	generatorInput.value = `当前可用的元件引脚列表:${Object.keys(CompPinList).length}`;
}
