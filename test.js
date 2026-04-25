/**
 * 解析单个范围字符串，如 "[0-9]" 返回 ['0','1',...,'9']
 * 只支持单个字符范围，如 0-9, A-Z, a-z
 */
function expandRange(rangeStr) {
	// 格式如 [0-9] 或 [A-Z] 或 [a-z]
	const match = rangeStr.match(/^([A-Z0-9])[-~:;；：]([A-Z0-9])$/i);
	if (!match) return [rangeStr];
	const start = match[1].charCodeAt(0);
	const end = match[2].charCodeAt(0);
	// if (start > end) throw new Error(`范围起始大于结束: ${rangeStr}`);
	if (start > end) return [rangeStr];
	const result = [];
	for (let i = start; i <= end; i++) {
		result.push(String.fromCharCode(i));
	}
	return result;
}

/**
 * 解析一个可能包含多个范围组合的表达式，如 "[A-Z]-[0-9]" 或 "abc"（普通字符串）
 * 返回该表达式展开后的所有字符串数组
 */
function expandExpression(expr) {
	// 如果不包含 '['，则是普通字符串
	if (!((expr.includes('[') && expr.includes(']')) || (expr.includes('【') && expr.includes('】')))) {
		return [expr];
	}
	// 按 '[' 或 ']' 分割，每个部分可能是范围或普通字符串
	const parts = expr.split(/[【[\]】]/g).filter((part) => part.trim() !== '');
	console.log('parts', parts);
	const expandedParts = parts.map((part) => {
		return expandRange(part);
	});

	// 计算笛卡尔积，从左向右构建
	let result = ['']; // 初始空字符串
	for (const current of expandedParts) {
		const newResult = [];
		for (const suffix of result) {
			for (const item of current) {
				newResult.push((suffix || '') + item);
			}
		}
		result = newResult;
	}
	return result;
}

/**
 * 解析递增规则的输入字符串，返回该行所有可能值的数组
 * 按逗号分隔各个部分，每个部分展开后顺序拼接
 */
function parseIncrementalRule(input) {
	const parts = input.split(/[,，]/).map((s) => s.trim());
	let sequence = [];
	for (const part of parts) {
		const expanded = expandExpression(part);
		sequence = sequence.concat(expanded);
	}
	return sequence;
}

/**
 * 根据所有行的配置创建迭代器
 * @param  rowsData - 每行对象 \{ type: 'FIXED'|'INCREMENTAL', value: string \}
 * @returns  \{ next: function \} 每次调用返回下一个拼接字符串，耗尽返回 null
 */
function sequenceGenerator(rowsData) {
	// 为每一行生成其值列表
	const rowSequences = rowsData.map((row) => {
		if (row.type === 'FIXED') {
			return [row.value]; // 固定行只有一个值
		} else if (row.type === 'INCREMENTAL') {
			return parseIncrementalRule(row.value);
		} else {
			throw new Error(`未知的行类型: ${row.type}`);
		}
	});
	console.log('rowSequences', rowSequences);

	// 计算笛卡尔积，从左向右构建
	let result = ['']; // 初始空字符串
	for (const current of rowSequences) {
		const newResult = [];
		for (const suffix of result) {
			for (const item of current) {
				newResult.push((suffix || '') + item);
			}
		}
		result = newResult;
	}
	const resultSequences = result;
	console.log('resultSequences', resultSequences);

	const totalCount = resultSequences.length;
	let currentIndex = -1;

	const next = () => {
		if (currentIndex >= totalCount - 1) return null;
		currentIndex++;
		const result = resultSequences[currentIndex];
		return result;
	};

	const previous = () => {
		if (currentIndex <= 0) return null;
		currentIndex--;
		const result = resultSequences[currentIndex];
		return result;
	};

	const reset = () => {
		currentIndex = -1;
	};

	return { next, previous, reset };
}

const generator = sequenceGenerator([
	{ type: 'FIXED', value: 'A-' },
	{ type: 'INCREMENTAL', value: '【0：2】' },
	// { type: 'INCREMENTAL', value: '[a-c]' },
]);

let i = 0;
const max = 5;
while (true) {
	const next = generator.next();
	if (!next) break;
	console.log('next', next);
	i++;
	if (i >= max) break;
}

i = 0;
while (true) {
	const pre = generator.previous();
	if (!pre) break;
	console.log('pre', pre);
	i++;
	if (i >= max) break;
}

i = 0;
while (true) {
	const next = generator.next();
	if (!next) break;
	console.log('next', next);
	i++;
	if (i >= max) break;
}

// 5eb30a30f48348cab67e425ec1ee229d  personal Lib
// 0819f05c4eef4c71ace90d822a990e87  system Lib
// fe959301b50945318df4c9e484f65b1c  ProjectUuid

// eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId().then(async (items) => {
// 	console.log('changeSelectedNetName', items);
// 	if (!items.length) return;

// 	for (const id of items) {
// 		const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
// 		console.log('changeSelectedNetName', id, type);

// 		if (type === 'Component') {
// 			const comp = await eda.sch_PrimitiveComponent.get(id);
// 			console.log('changeSelectedNetName', id, comp);
// 		} else if (type === 'netlabel') {
// 			const netlabel = await eda.sch_PrimitiveText.get(id);
// 			console.log('changeSelectedNetName', id, netlabel);
// 		}
// 	}
// });

eda.sch_Event.addMouseEventListener(
	'Selected',
	'selected',
	async () => {
		const primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
		for (const id of primitiveIds) {
			const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
			if (type === 'Component') {
				const comp = await eda.sch_PrimitiveComponent.get(id);
				console.log('getOrSetNetName', id, comp);
				comp.done();
			}
		}
	},
	true,
);

eda.sch_SelectControl.getAllSelectedPrimitives().then(async (e) => {
	console.log('get', e);
	for (const comp of e) {
		if (comp.primitiveType === 'Component') {
			const id = comp.primitiveId;
			console.log('getOrSetNetName', id, comp);
			if (['netport', 'offPageConnector', 'netflag'].includes(comp.getState_ComponentType())) {
				const result = await eda.sch_PrimitiveComponent.delete(id);
				console.log('delete old', result);
				const netPort = await eda.sch_PrimitiveComponent.create(comp.component, comp.x, comp.y, '', comp.rotation, comp.mirror);
				console.log('netPort', netPort);
				netPort.setState_Name('NEEEE');
			}
		}
	}
});

const sch_getAllSelectedPrimitives = [
	{
		'async': true,
		'primitiveType': 'Component',
		'componentType': 'part',
		'component': {
			'libraryUuid': 'fe959301b50945318df4c9e484f65b1c',
			'uuid': '0895e96e5851a3ab',
		},
		'x': 135,
		'y': 320,
		'subPartName': 'BD9412F-GE2.1',
		'rotation': 0,
		'mirror': false,
		'addIntoBom': true,
		'addIntoPcb': true,
		'net': '',
		'primitiveId': '98b777910bad1190',
		'symbol': {
			'libraryUuid': 'fe959301b50945318df4c9e484f65b1c',
			'uuid': '755492d7fe98649e',
		},
		'footprint': {
			'libraryUuid': 'fe959301b50945318df4c9e484f65b1c',
			'uuid': '5ff92ce5bc02fa18',
		},
		'designator': 'U1',
		'name': '={Manufacturer Part}',
		'uniqueId': 'gge1',
		'manufacturer': 'ROHM(罗姆)',
		'manufacturerId': 'BD9412F-GE2',
		'supplier': 'LCSC',
		'supplierId': 'C6470691',
		'otherProperty': {
			'Symbol': '755492d7fe98649e',
			'Device': '0895e96e5851a3ab',
			'Footprint': '5ff92ce5bc02fa18',
			'Reuse Block': '',
			'Group ID': '',
			'Channel ID': '',
			'LCSC Part Name': 'BD9412F-GE2',
			'Supplier Footprint': 'SOIC-18-208mil',
			'JLCPCB Part Class': 'Extended Part',
			'Datasheet': 'https://item.szlcsc.com/datasheet/BD9412F-GE2/7423887.html',
			'3D Model': '1a0b2b412d4f473b912215bd29e6aa49|0819f05c4eef4c71ace90d822a990e87',
			'3D Model Title': 'SOP-18_L11.2-W5.4-P1.27-LS7.8-BL',
			'3D Model Transform': '440.944,307.086,0,0,0,0,0,0,0',
			'Type': 'DC-DC',
			'Voltage - Input(DC)': '9V~18V',
			'Frequency - Switching': '60kHz',
			'Number of Channels': '1',
			'Output Voltage': '-',
			'Output Current': '-',
			'Dimming': 'PWM；模拟',
			'Features': '-',
			'Voltage - Input(AC)': '-',
			'Topology': '推挽',
			'Operating temperature': '-40℃~+85℃',
			'Switch Tube (Built-In/External)': '-',
			'Constant Current Accuracy': '-',
			'Description': '类型:DC-DC;工作电压(DC):9V~18V;开关频率:60kHz;通道数:1;输出电压:-;输出电流:-;调光:PWM；模拟;拓扑结构:推挽;',
		},
	},
];

const pcb_getAllSelectedPrimitives = [
	{
		'async': true,
		'primitiveType': 'Component',
		'component': {
			'libraryUuid': 'fe959301b50945318df4c9e484f65b1c',
			'uuid': '0895e96e5851a3ab',
		},
		'layer': 1,
		'x': 380,
		'y': 560,
		'rotation': 180,
		'primitiveLock': false,
		'addIntoBom': 'yes',
		'primitiveId': 'd1f9d37b09c21463',
		'footprint': {
			'libraryUuid': 'fe959301b50945318df4c9e484f65b1c',
			'uuid': '5ff92ce5bc02fa18',
		},
		'model3D': {
			'libraryUuid': '0819f05c4eef4c71ace90d822a990e87',
			'uuid': '1a0b2b412d4f473b912215bd29e6aa49',
		},
		'designator': 'U1',
		'pads': [
			{
				'num': '1',
				'net': 'NET1',
				'id': 'e9',
			},
			{
				'num': '2',
				'net': '',
				'id': 'e10',
			},
			{
				'num': '3',
				'net': '',
				'id': 'e11',
			},
			{
				'num': '4',
				'net': '',
				'id': 'e12',
			},
			{
				'num': '5',
				'net': '',
				'id': 'e13',
			},
			{
				'num': '6',
				'net': '',
				'id': 'e14',
			},
			{
				'num': '7',
				'net': '',
				'id': 'e15',
			},
			{
				'num': '8',
				'net': '',
				'id': 'e16',
			},
			{
				'num': '9',
				'net': '',
				'id': 'e17',
			},
			{
				'num': '18',
				'net': 'A-0_A',
				'id': 'e18',
			},
			{
				'num': '17',
				'net': 'A-0_T',
				'id': 'e19',
			},
			{
				'num': '16',
				'net': 'BUS0',
				'id': 'e20',
			},
			{
				'num': '15',
				'net': 'A-2_CC',
				'id': 'e21',
			},
			{
				'num': '14',
				'net': 'A-2_CC',
				'id': 'e22',
			},
			{
				'num': '13',
				'net': 'A-0_S',
				'id': 'e23',
			},
			{
				'num': '12',
				'net': '$1N2',
				'id': 'e24',
			},
			{
				'num': '11',
				'net': 'VCC',
				'id': 'e25',
			},
			{
				'num': '10',
				'net': 'A-0_B',
				'id': 'e26',
			},
		],
		'name': '={Manufacturer Part}',
		'uniqueId': 'gge1',
		'manufacturer': 'ROHM(罗姆)',
		'manufacturerId': 'BD9412F-GE2',
		'supplier': 'LCSC',
		'supplierId': 'C6470691',
		'otherProperty': {
			'Footprint': 'SOP-18_L11.2-W5.4-P1.27-LS7.8-BL',
			'LCSC Part Name': 'BD9412F-GE2',
			'Supplier Footprint': 'SOIC-18-208mil',
			'JLCPCB Part Class': 'Extended Part',
			'Datasheet': 'https://item.szlcsc.com/datasheet/BD9412F-GE2/7423887.html',
			'3D Model': '1a0b2b412d4f473b912215bd29e6aa49|0819f05c4eef4c71ace90d822a990e87',
			'3D Model Title': 'SOP-18_L11.2-W5.4-P1.27-LS7.8-BL',
			'3D Model Transform': '440.944,307.086,0,0,0,0,0,0,0',
			'Type': 'DC-DC',
			'Voltage - Input(DC)': '9V~18V',
			'Frequency - Switching': '60kHz',
			'Number of Channels': '1',
			'Output Voltage': '-',
			'Output Current': '-',
			'Dimming': 'PWM；模拟',
			'Features': '-',
			'Voltage - Input(AC)': '-',
			'Topology': '推挽',
			'Operating temperature': '-40℃~+85℃',
			'Switch Tube (Built-In/External)': '-',
			'Constant Current Accuracy': '-',
			'Description': '类型:DC-DC;工作电压(DC):9V~18V;开关频率:60kHz;通道数:1;输出电压:-;输出电流:-;调光:PWM；模拟;拓扑结构:推挽;',
			'Device': 'BD9412F-GE2',
			'Reuse Block': '',
			'Group ID': '',
			'Channel ID': '$1I2',
		},
	},
];

const getNetlistFile_components = {
	'gge1': {
		'props': {
			'Add into BOM': 'yes',
			'Convert to PCB': 'yes',
			'Symbol': '755492d7fe98649e',
			'Designator': 'U1',
			'Device': '0895e96e5851a3ab',
			'Unique ID': 'gge1',
			'Footprint': '5ff92ce5bc02fa18',
			'Name': '={Manufacturer Part}',
			'Reuse Block': '',
			'Group ID': '',
			'Channel ID': '$1I2',
			'LCSC Part Name': 'BD9412F-GE2',
			'Supplier Part': 'C6470691',
			'Manufacturer': 'ROHM(罗姆)',
			'Manufacturer Part': 'BD9412F-GE2',
			'Supplier Footprint': 'SOIC-18-208mil',
			'JLCPCB Part Class': 'Extended Part',
			'Datasheet': 'https://item.szlcsc.com/datasheet/BD9412F-GE2/7423887.html',
			'Supplier': 'LCSC',
			'3D Model': '1a0b2b412d4f473b912215bd29e6aa49|0819f05c4eef4c71ace90d822a990e87',
			'3D Model Title': 'SOP-18_L11.2-W5.4-P1.27-LS7.8-BL',
			'3D Model Transform': '440.944,307.086,0,0,0,0,0,0,0',
			'Type': 'DC-DC',
			'Voltage - Input(DC)': '9V~18V',
			'Frequency - Switching': '60kHz',
			'Number of Channels': '1',
			'Output Voltage': '-',
			'Output Current': '-',
			'Dimming': 'PWM；模拟',
			'Features': '-',
			'Voltage - Input(AC)': '-',
			'Topology': '推挽',
			'Operating temperature': '-40℃~+85℃',
			'Switch Tube (Built-In/External)': '-',
			'Constant Current Accuracy': '-',
			'Description': '类型:DC-DC;工作电压(DC):9V~18V;开关频率:60kHz;通道数:1;输出电压:-;输出电流:-;调光:PWM；模拟;拓扑结构:推挽;',
			'DeviceName': 'BD9412F-GE2',
			'FootprintName': 'SOP-18_L11.2-W5.4-P1.27-LS7.8-BL',
		},
		'pinInfoMap': {
			'1': {
				'name': 'VCC',
				'number': '1',
				'net': 'NET1',
				'props': {
					'Pin Number': '1',
				},
			},
			'2': {
				'name': 'STB',
				'number': '2',
				'net': '',
				'props': {
					'Pin Number': '2',
				},
			},
			'3': {
				'name': 'GND',
				'number': '3',
				'net': '',
				'props': {
					'Pin Number': '3',
				},
			},
			'4': {
				'name': 'RT',
				'number': '4',
				'net': '',
				'props': {
					'Pin Number': '4',
				},
			},
			'5': {
				'name': 'FB',
				'number': '5',
				'net': '',
				'props': {
					'Pin Number': '5',
				},
			},
			'6': {
				'name': 'IS',
				'number': '6',
				'net': '',
				'props': {
					'Pin Number': '6',
				},
			},
			'7': {
				'name': 'VS',
				'number': '7',
				'net': '',
				'props': {
					'Pin Number': '7',
				},
			},
			'8': {
				'name': 'PWMCMP',
				'number': '8',
				'net': '',
				'props': {
					'Pin Number': '8',
				},
			},
			'9': {
				'name': 'CP',
				'number': '9',
				'net': '',
				'props': {
					'Pin Number': '9',
				},
			},
			'10': {
				'name': 'PWM_IN',
				'number': '10',
				'net': 'A-0_B',
				'props': {
					'Pin Number': '10',
				},
			},
			'11': {
				'name': 'ADIM',
				'number': '11',
				'net': 'VCC',
				'props': {
					'Pin Number': '11',
				},
			},
			'12': {
				'name': 'SS',
				'number': '12',
				'net': '$1N2',
				'props': {
					'Pin Number': '12',
				},
			},
			'13': {
				'name': 'FAIL',
				'number': '13',
				'net': 'A-0_S',
				'props': {
					'Pin Number': '13',
				},
			},
			'14': {
				'name': 'COMPSD',
				'number': '14',
				'net': 'A-2_CC',
				'props': {
					'Pin Number': '14',
				},
			},
			'15': {
				'name': 'PWM2DC',
				'number': '15',
				'net': 'A-2_CC',
				'props': {
					'Pin Number': '15',
				},
			},
			'16': {
				'name': 'PGND',
				'number': '16',
				'net': 'BUS0',
				'props': {
					'Pin Number': '16',
				},
			},
			'17': {
				'name': 'N2',
				'number': '17',
				'net': 'A-0_T',
				'props': {
					'Pin Number': '17',
				},
			},
			'18': {
				'name': 'N1',
				'number': '18',
				'net': 'A-0_A',
				'props': {
					'Pin Number': '18',
				},
			},
		},
	},
};

const getAllPinsByPrimitiveId = [
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 360,
		'pinNumber': '1',
		'pinName': 'VCC',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e5',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 350,
		'pinNumber': '2',
		'pinName': 'STB',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e9',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 340,
		'pinNumber': '3',
		'pinName': 'GND',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e13',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 330,
		'pinNumber': '4',
		'pinName': 'RT',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e17',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 320,
		'pinNumber': '5',
		'pinName': 'FB',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e21',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 310,
		'pinNumber': '6',
		'pinName': 'IS',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e25',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 300,
		'pinNumber': '7',
		'pinName': 'VS',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e29',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 290,
		'pinNumber': '8',
		'pinName': 'PWMCMP',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e33',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 80,
		'y': 280,
		'pinNumber': '9',
		'pinName': 'CP',
		'rotation': 180,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e37',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 280,
		'pinNumber': '10',
		'pinName': 'PWM_IN',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e41',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 290,
		'pinNumber': '11',
		'pinName': 'ADIM',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e45',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 300,
		'pinNumber': '12',
		'pinName': 'SS',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e49',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 310,
		'pinNumber': '13',
		'pinName': 'FAIL',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e53',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 320,
		'pinNumber': '14',
		'pinName': 'COMPSD',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e57',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 330,
		'pinNumber': '15',
		'pinName': 'PWM2DC',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e61',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 340,
		'pinNumber': '16',
		'pinName': 'PGND',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e65',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 350,
		'pinNumber': '17',
		'pinName': 'N2',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e69',
		'noConnected': false,
	},
	{
		'async': true,
		'primitiveType': 'ComponentPin',
		'x': 190,
		'y': 360,
		'pinNumber': '18',
		'pinName': 'N1',
		'rotation': 0,
		'pinLength': 10,
		'pinColor': null,
		'pinShape': 'None',
		'pinType': 'Undefined',
		'primitiveId': '98b777910bad1190-e73',
		'noConnected': false,
	},
];

// 按规则更改网络端口为默认端口符号
const NameList = ['osys-in'];
const ReplaceMap = {
	'osys-in': 'IN',
};
const allNetport = await eda.sch_PrimitiveComponent.getAll('netport');
console.log('allNetport', allNetport);
let addCount = 0;
let delCount = 0;

for (const netport of allNetport) {
	if (NameList.includes(netport?.component?.name)) {
		const newType = ReplaceMap[netport.component.name];
		console.log('newType:', newType, 'currentName:', netport.component.name);
		const delResult = await eda.sch_PrimitiveComponent.delete(netport.primitiveId);
		delCount++;
		console.log('delResult', delResult);
		if (!delResult) {
			delCount--;
			eda.sys_Message.showToastMessage(`删除旧端口失败, 网络名:${netport.net},坐标:[${netport.x / 100},${netport.y / 100}]`, 'info', 5);
		}
		const newNetport = await eda.sch_PrimitiveComponent.createNetPort(
			newType,
			netport.net,
			netport.x,
			netport.y,
			netport.rotation,
			netport.mirror,
		);
		addCount++;
		console.log('newNetport', newNetport);
	}
}
eda.sys_Message.showToastMessage(`因修改端口的原点可能和默认端口的不同, 请手动检查修改后的端口`, 'info', 5);
eda.sys_Message.showToastMessage(`删除端口${delCount}个, 新增端口${addCount}个`, 'info', 5);


