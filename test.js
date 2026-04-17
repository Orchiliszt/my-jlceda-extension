/**
 * 解析单个范围字符串，如 "[0-9]" 返回 ['0','1',...,'9']
 * 只支持单个字符范围，如 0-9, A-Z, a-z
 */
function expandRange(rangeStr) {
	// 格式如 [0-9] 或 [A-Z] 或 [a-z]
	const match = rangeStr.match(/^([A-Za-z0-9])[-~:;；：]([A-Za-z0-9])$/);
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
	const parts = expr.split(/[【\[\]】]/g).filter((part) => part.trim() !== '');
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
				newResult.push((suffix ? suffix : '') + item);
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
				newResult.push((suffix ? suffix : '') + item);
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
	//{ type: 'INCREMENTAL', value: '[a-c]' },
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
				comp.forEach((item) => {
					console.log('getOrSetNetName', id, item);
					if (['netport', 'offPageConnector', 'netflag'].includes(item.getState_ComponentType())) {
						item.done();
					}
					console.log('getOrSetNetName', id, item);
				});
			}
		}
	},
	true,
);
