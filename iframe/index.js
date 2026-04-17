const FIXED = 'fixed';
const INCREMENTAL = 'incremental';
let TemplateData = [];
let currentNetName = '';

/**
 * 历史记录
 * [[\{ id: string, netNames: [] \}, \{...\}...], [...]...]
 */
const historyList = [];
const maxHistoryLength = 20;

// ---------- DOM 元素 ----------
const container = document.getElementById('rowsContainer');
const generatorView = document.getElementById('generatorView');
const generatorInput = document.getElementById('generatorInput');
const mainBar = document.getElementById('mainBar');
const generatorBar = document.getElementById('generatorBar');
const startBtn = document.getElementById('start');
const cancelBtn = document.getElementById('cancel');
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const autoIncCheck = document.getElementById('autoIncrement');
const undoBtn = document.getElementById('undoBtn');
const preBtn = document.getElementById('preBtn');

cancelBtn.addEventListener('click', close);

TemplateData = eda.sys_Storage.getExtensionUserConfig('TemplateData');
if (!TemplateData) {
	TemplateData = [];
}

let currentGenerator = '';

// 初始化
ensureRowExists();

// 事件委托处理
container.addEventListener('click', (e) => {
	const addBtn = e.target.closest('.add-btn');
	if (addBtn) {
		e.preventDefault();
		const currentRow = addBtn.closest('.row');
		if (!currentRow) return;
		const newRow = createRow();
		currentRow.insertAdjacentElement('afterend', newRow);
		return;
	}

	const deleteBtn = e.target.closest('.delete-btn');
	if (deleteBtn) {
		e.preventDefault();
		const currentRow = deleteBtn.closest('.row');
		if (!currentRow) return;

		const allRows = document.querySelectorAll('.row');
		if (allRows.length <= 1) {
			eda.sys_Message.showToastMessage('至少保留一行', 'info', 3);
			// alert('至少保留一行');
			return;
		}
		currentRow.remove();
	}
});

// ---------- 主按钮事件 ----------
startBtn.addEventListener('click', () => {
	const rows = document.querySelectorAll('.row');
	const rowsData = Array.from(rows).map((row) => ({
		type: row.querySelector('select')?.value || '',
		value: row.querySelector('input')?.value || '',
	}));
	TemplateData = rowsData;
	console.log('start:TemplateData', TemplateData);
	currentGenerator = sequenceGenerator(TemplateData);

	// 隐藏动态行区域和主按钮栏
	container.classList.add('hidden');
	mainBar.classList.add('hidden');
	// 显示生成器视图及其按钮栏
	generatorView.classList.remove('hidden');
	generatorBar.classList.remove('hidden');

	// 获取第一个字符串并显示
	getNext();

	eda.sys_Storage.setExtensionUserConfig('TemplateData', TemplateData);
	eda.sch_Event.addMouseEventListener('Selected', 'selected', changeSelectedNetName);
	// eda.sys_Message.showToastMessage('请注意:该插件执行的修改可以使用工具撤销', 'info', 3);
});

nextBtn.addEventListener('click', getNext);
preBtn.addEventListener('click', getPrevious);

// 返回：回到主视图
backBtn.addEventListener('click', () => {
	container.classList.remove('hidden');
	mainBar.classList.remove('hidden');
	generatorView.classList.add('hidden');
	generatorBar.classList.add('hidden');

	currentGenerator = '';
	// eda.sys_Message.removeFollowMouseTip();
	console.log('removeEventListener', eda.sch_Event.removeEventListener('Selected'));
});

undoBtn.addEventListener('click', undoChangeOnce);

// // 防止意外清空（如最后一行被外部代码删除）
// const observer = new MutationObserver(() => {
// 	if (container.children.length === 0) {
// 		container.appendChild(createRow());
// 	}
// });
// observer.observe(container, { childList: true, subtree: false });

async function close() {
	console.log('auxiliary window closed');
	await eda.sys_IFrame.closeIFrame();
}

// 创建一行：选择框 + 输入框 + 两个符号按钮 (+/×)
function createRow(selectValue = FIXED, inputValue = '') {
	const rowDiv = document.createElement('div');
	rowDiv.className = 'row';

	const select = document.createElement('select');
	const opt1 = document.createElement('option');
	opt1.value = FIXED;
	opt1.textContent = '固定';
	const opt2 = document.createElement('option');
	opt2.value = INCREMENTAL;
	opt2.textContent = '递增';
	select.appendChild(opt1);
	select.appendChild(opt2);
	select.value = selectValue;

	const input = document.createElement('input');
	input.type = 'text';
	input.placeholder = '输入';
	input.spellcheck = false;
	input.value = inputValue;

	const addBtn = document.createElement('button');
	addBtn.type = 'button';
	addBtn.className = 'add-btn';
	addBtn.textContent = '+';
	addBtn.setAttribute('aria-label', '添加一行');
	addBtn.title = '添加一行';

	const deleteBtn = document.createElement('button');
	deleteBtn.type = 'button';
	deleteBtn.className = 'delete-btn';
	deleteBtn.textContent = '×';
	deleteBtn.setAttribute('aria-label', '删除此行');
	deleteBtn.title = '删除此行';

	rowDiv.appendChild(select);
	rowDiv.appendChild(input);
	rowDiv.appendChild(addBtn);
	rowDiv.appendChild(deleteBtn);

	return rowDiv;
}

/**
 * 根据原始数据重建卡片内的所有行
 */
function ensureRowExists() {
	container.innerHTML = ''; // 清空现有行
	const data = TemplateData;

	if (data && Array.isArray(data) && data.length > 0) {
		data.forEach((item) => {
			// 映射 type：将 "fixed"/"incremental" 转换为组件内部使用的 "FIXED"/"INCREMENTAL"
			const selectValue = item.type === 'incremental' ? INCREMENTAL : FIXED;
			const inputValue = item.value || '';
			const row = createRow(selectValue, inputValue);
			container.appendChild(row);
		});
	} else {
		// 如果没有数据或数据为空，至少添加一行默认行（可选）
		container.appendChild(createRow(FIXED, ''));
	}
}

/**
 * 改变选中的组件的端口名称
 */
function changeSelectedNetName() {
	if (currentNetName === '') {
		eda.sys_Message.showToastMessage('待修改为的网络名为空', 'info', 3);
		return;
	}
	console.log('changeSelectedNetName', currentNetName);
	eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId().then(async (items) => {
		console.log('changeSelectedNetName', items);
		if (!items.length) return;
		let updateFlag = false;
		const oldNetName = [];

		for (const id of items) {
			const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
			console.log('changeSelectedNetName', id, type);
			let tempUpdateFlag = false;
			if (type === 'Component') {
				const comp = await eda.sch_PrimitiveComponent.get(id);
				console.log('changeSelectedNetName', id, comp);
				const tempNetName = [];
				comp.forEach((item) => {
					tempNetName.push(item.getState_Net());
					if (['netport', 'offPageConnector', 'netflag'].includes(item.getState_ComponentType())) {
						item.setState_Name(currentNetName);
						item.done();
						tempUpdateFlag = updateFlag = true;
					}
				});
				if (tempUpdateFlag) oldNetName.push({ id, netNames: tempNetName });
			} else if (type === 'netlabel') {
				const netlabel = await eda.sch_PrimitiveText.get(id);
				console.log('changeSelectedNetName', id, netlabel);
				const tempNetName = [netlabel?.getState_Content()];

				const result = await eda.sch_PrimitiveText.modify(id, { content: currentNetName });
				if (result) {
					updateFlag = true;
					oldNetName.push({ id, netNames: tempNetName });
				} else {
					console.log('changeSelectedNetName', 'change netlabel fail');
					eda.sys_Message.showToastMessage('修改网络标签失败', 'warning', 3);
				}
			} else if (type === 'Text') {
				eda.sys_Message.showToastMessage('当前选中为文本, 请点击到端口', 'info', 3);
			}
		}
		if (updateFlag) {
			historyList.push(oldNetName);
			if (historyList.length > maxHistoryLength) {
				historyList.shift();
			}
			console.log('historyList', historyList);
		}

		if (autoIncCheck.checked && updateFlag) {
			getNext();
		}
	});
}

/**
 * 撤销一次修改
 */
async function undoChangeOnce() {
	if (!historyList.length) {
		eda.sys_Message.showToastMessage('无更改记录', 'info', 3);
		return;
	}

	const oldNetName = historyList.pop();
	for (const { id, netNames } of oldNetName) {
		console.log('undoChangeOnce', id, netNames);
		const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(id);
		console.log('undoChangeOnce', id, type);

		if (type === 'Component') {
			const comp = await eda.sch_PrimitiveComponent.get(id);
			console.log('undoChangeOnce', id, comp);

			comp.forEach((item, index) => {
				const componentType = item.getState_ComponentType();
				if (['netport', 'netflag'].includes(componentType)) {
					item.setState_Name(netNames[index]);
					item.done();
				} else if (componentType === 'offPageConnector') {
					eda.sys_Message.showToastMessage('暂不支持撤销对跨页链接标识的修改', 'info', 3);
				}
			});
		} else if (type === 'netlabel') {
			const result = await eda.sch_PrimitiveText.modify(id, { content: netNames[0] });
			if (result) {
				updateFlag = true;
			} else {
				console.log('undoChangeOnce', 'change netlabel fail');
				eda.sys_Message.showToastMessage('撤销修改网络标签失败', 'warning', 3);
			}
		}
	}
}

// 下一个：获取下一个组合字符串并显示 (如果结束则自动重置循环)
function getNext() {
	if (!currentGenerator) {
		console.info('currentGenerator is null');
		eda.sys_Message.showToastMessage('网络标签序列生成失败, 请关闭重试', 'error', 3);
		return;
	}
	let nextVal = currentGenerator.next();
	if (nextVal === null) {
		// 已穷尽，重置并从头开始
		currentGenerator.reset();
		nextVal = currentGenerator.next();
		// eda.sys_Message.showToastMessage('网络遍历结束,重新开始', 'info', 3);
	}
	currentNetName = nextVal;
	generatorInput.value = currentNetName;
	console.log('getNext:', currentNetName);
	// eda.sys_Message.showFollowMouseTip(currentNetName, 0);
}

function getPrevious() {
	if (!currentGenerator) {
		console.info('currentGenerator is null');
		eda.sys_Message.showToastMessage('网络标签序列生成失败, 请关闭重试', 'error', 3);
		return;
	}
	let preVal = currentGenerator.previous();
	if (preVal === null) {
		eda.sys_Message.showToastMessage('已到序列最前端，无上一个', 'info', 3);
		return;
	}
	currentNetName = preVal;
	generatorInput.value = currentNetName;
	console.log('getPrevious:', currentNetName);
	// eda.sys_Message.showFollowMouseTip(currentNetName, 0);
}

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
		if (row.type === FIXED) {
			return [row.value]; // 固定行只有一个值
		} else if (row.type === INCREMENTAL) {
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

	// const totalRows = rowSequences.length;
	// const currentIndices = new Array(totalRows).fill(0);
	// let ended = false;
	//
	// const next = () => {
	// 	if (ended) return null;
	// 	// 拼接当前组合
	// 	let result = '';
	// 	for (let i = 0; i < totalRows; i++) {
	// 		result += rowSequences[i][currentIndices[i]];
	// 	}
	// 	// 递增索引
	// 	let carry = true;
	// 	for (let i = totalRows - 1; i >= 0 && carry; i--) {
	// 		if (currentIndices[i] + 1 < rowSequences[i].length) {
	// 			currentIndices[i]++;
	// 			carry = false;
	// 		} else {
	// 			currentIndices[i] = 0;
	// 		}
	// 	}
	// 	if (carry) ended = true;
	// 	return result;
	// };
	//
	// const reset = () => {
	// 	currentIndices.fill(0);
	// 	ended = false;
	// };
	//return { next, reset };
}
