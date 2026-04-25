let NetNames = [];
const GET = false;
const SET = true;
let CurrentStatus = GET;

const startBtn = document.getElementById('start');
const cancelBtn = document.getElementById('cancel');
const generatorInput = document.getElementById('generatorInput');
generatorInput.value = '未开始';

startBtn.addEventListener('click', () => {
	CurrentStatus = GET;
	generatorInput.value = '待复制';
	eda.sch_Event.addMouseEventListener('getOrSetNet', 'selected', getOrSetNetName);
});

cancelBtn.addEventListener('click', () => {
	NetNames = [];
	generatorInput.value = '未开始';
	if (eda.sch_Event.isEventListenerAlreadyExist('getOrSetNet')) {
		const result = eda.sch_Event.removeEventListener('getOrSetNet');
		console.log('removeEventListener', result);
	}
});

async function getOrSetNetName() {
	const primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
	console.log('getOrSetNetName', primitiveIds);
	if (!primitiveIds.length)
		return;

	let tempStatus = CurrentStatus;

	for (const id of primitiveIds) {
		const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
		console.log('getOrSetNetName', id, type);
		if (type === 'Component') {
			const comp = await eda.sch_PrimitiveComponent.get(id);
			console.log('getOrSetNetName', id, comp);
			if (['netport', 'offPageConnector', 'netflag'].includes(comp.getState_ComponentType())) {
				if (CurrentStatus === GET) {
					NetNames.push(comp.getState_Net());
					tempStatus = SET;
				}
				else {
					if (NetNames.length === 0) {
						return;
					}
					const netName = NetNames.shift();
					comp.setState_Name(netName);
					comp.done();
				}
			}
		}
	}
	CurrentStatus = tempStatus;
	if (NetNames.length === 0)
		CurrentStatus = GET;
	if (CurrentStatus === GET) {
		generatorInput.value = '待复制';
	}
	else {
		generatorInput.value = NetNames.join('、');
	}
}
