// ==================== 数据 ====================
const dataMap = {
	netClass: {
		Backbone_Class: ['NET_BB_001', 'NET_BB_002', 'NET_BB_003', 'NET_BB_004', 'NET_BB_005', 'NET_BB_006'],
		Access_Class: ['NET_ACC_001', 'NET_ACC_002', 'NET_ACC_003', 'NET_ACC_004'],
		Core_Class: ['NET_CORE_001', 'NET_CORE_002', 'NET_CORE_003', 'NET_CORE_004', 'NET_CORE_005'],
		Distribution_Class: ['NET_DIST_001', 'NET_DIST_002', 'NET_DIST_003'],
		Edge_Class: ['NET_EDGE_001', 'NET_EDGE_002', 'NET_EDGE_003', 'NET_EDGE_004', 'NET_EDGE_005', 'NET_EDGE_006', 'NET_EDGE_007'],
	},
	netGroup: {
		Group_Alpha: ['NET_AL_01', 'NET_AL_02', 'NET_AL_03', 'NET_AL_04', 'NET_AL_05'],
		Group_Beta: ['NET_BT_01', 'NET_BT_02', 'NET_BT_03'],
		Group_Gamma: ['NET_GM_01', 'NET_GM_02', 'NET_GM_03', 'NET_GM_04'],
		Group_Delta: ['NET_DL_01', 'NET_DL_02', 'NET_DL_03', 'NET_DL_04', 'NET_DL_05', 'NET_DL_06'],
		Group_Epsilon: ['NET_EP_01', 'NET_EP_02', 'NET_EP_03', 'NET_EP_04'],
	},
};

// DOM
const radioNetClass = document.querySelector('input[value="netClass"]');
const radioNetGroup = document.querySelector('input[value="netGroup"]');
const comboboxInput = document.getElementById('comboboxInput');
const comboboxDropdown = document.getElementById('comboboxDropdown');
const comboboxArrow = document.getElementById('comboboxArrow');
const comboboxWrapper = document.getElementById('comboboxWrapper');
const filterInput = document.getElementById('filterInput');
const listContainer = document.getElementById('listContainer');
const listInner = document.getElementById('listInner');
const listCountHint = document.getElementById('listCountHint');
const btnAdd = document.getElementById('btnAdd');
const btnRemove = document.getElementById('btnRemove');
const btnStop = document.getElementById('btnStop');
const btnApply = document.getElementById('btnApply');
const toast = document.getElementById('toast');

// 状态
let currentCategoryType = 'netClass';
let currentCategoryName = null;
let currentNetworkNames = []; // 当前组的所有网络名（不含筛选）
let activeNetworkNames = []; // 筛选后的列表

// 临时修改集合
const pendingAdded = new Set(); // 新添加的网络名（带*）
const pendingRemoved = new Set(); // 待删除的网络名（带*）

// 多选状态
let selectedIndices = new Set();
let lastClickIndex = -1;

// 开始添加/停止监听状态
let isAddingMode = false;

// 类别记忆（存储各类型最后选择的组名）
const lastSelectedGroup = {
	netClass: null,
	netGroup: null,
};

// Toast
let toastTimer;
function showToast(msg) {
	if (toastTimer)
		clearTimeout(toastTimer);
	toast.textContent = msg;
	toast.classList.add('show');
	toastTimer = setTimeout(() => {
		toast.classList.remove('show');
		toastTimer = null;
	}, 1500);
}

// 获取当前类型的所有组名
function getCategoryOptions() {
	return Object.keys(dataMap[currentCategoryType]);
}

// 下拉框操作
function openDropdown(filterText = null) {
	const options = getCategoryOptions();
	let filtered = options;
	if (filterText !== null && filterText.trim() !== '') {
		const lower = filterText.trim().toLowerCase();
		filtered = options.filter(opt => opt.toLowerCase().includes(lower));
	}
	renderDropdownOptions(filtered);
	comboboxDropdown.classList.add('open');
}

function closeDropdown() {
	comboboxDropdown.classList.remove('open');
}

function renderDropdownOptions(options) {
	comboboxDropdown.innerHTML = '';
	if (options.length === 0) {
		const li = document.createElement('li');
		li.textContent = '无匹配选项';
		li.classList.add('no-match');
		comboboxDropdown.appendChild(li);
	}
	else {
		options.forEach((opt) => {
			const li = document.createElement('li');
			li.textContent = opt;
			li.dataset.value = opt;
			if (opt === currentCategoryName)
				li.classList.add('active');
			li.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				selectCategory(opt);
				closeDropdown();
				comboboxInput.blur();
			});
			comboboxDropdown.appendChild(li);
		});
	}
}

// 选择某个网络类/组
function selectCategory(name) {
	// 丢弃当前所有临时更改
	pendingAdded.clear();
	pendingRemoved.clear();
	selectedIndices.clear();
	lastClickIndex = -1;

	currentCategoryName = name;
	comboboxInput.value = name;
	// 加载数据
	const data = dataMap[currentCategoryType];
	currentNetworkNames = data[name] ? [...data[name]] : [];

	// 记忆该类别下的选择
	lastSelectedGroup[currentCategoryType] = name;

	filterInput.value = '';
	applyFilterAndRender();
}

// 筛选
function getFilteredNetworkNames() {
	const filter = filterInput.value.trim().toLowerCase();
	if (!filter)
		return currentNetworkNames;
	return currentNetworkNames.filter(n => n.toLowerCase().includes(filter));
}

function applyFilterAndRender() {
	const oldActive = activeNetworkNames;
	activeNetworkNames = getFilteredNetworkNames();
	// 清理选中索引中无效的索引
	const validSelected = new Set();
	for (const idx of selectedIndices) {
		const i = activeNetworkNames.findIndex(e => e === oldActive[idx]);
		if (i >= 0)
			validSelected.add(i);
	}
	selectedIndices = validSelected;
	if (lastClickIndex >= activeNetworkNames.length)
		lastClickIndex = -1;
	renderList();
	updateCountHint();
	updateButtonStates();
}

// 渲染列表
function renderList() {
	listInner.innerHTML = '';
	if (activeNetworkNames.length === 0) {
		const placeholder = document.createElement('div');
		placeholder.classList.add('list-placeholder');
		if (!currentCategoryName)
			placeholder.textContent = '请先选择一个网络类或等长网络组';
		else if (filterInput.value.trim())
			placeholder.textContent = '没有匹配的网络名';
		else placeholder.textContent = '该类别下暂无网络名';
		listInner.appendChild(placeholder);
		return;
	}

	activeNetworkNames.forEach((name, idx) => {
		const item = document.createElement('div');
		item.classList.add('list-item');
		item.textContent = name;
		item.dataset.index = idx;
		item.dataset.name = name;

		if (selectedIndices.has(idx))
			item.classList.add('selected');
		// 显示红色*或删除线：如果在待添加或待删除集合中
		if (pendingAdded.has(name)) {
			item.classList.add('pending');
		}
		if (pendingRemoved.has(name)) {
			item.classList.add('delete');
		}

		item.addEventListener('mousedown', (e) => {
			e.preventDefault();
			handleItemClick(idx, e);
		});
		listInner.appendChild(item);
	});
}

function updateCountHint() {
	const total = activeNetworkNames.length;
	const selected = selectedIndices.size;
	const pendingCount = [...activeNetworkNames].filter(n => pendingAdded.has(n) || pendingRemoved.has(n)).length;
	if (total === 0) {
		listCountHint.textContent = '';
	}
	else {
		const parts = [`共 ${total} 个`];
		if (selected > 0)
			parts.push(`已选 ${selected} 个`);
		if (pendingCount > 0)
			parts.push(`待处理 ${pendingCount} 个`);
		listCountHint.textContent = parts.join('  ·  ');
	}
}

function updateButtonStates() {
	const hasSelection = selectedIndices.size > 0;
	const hasPending = pendingAdded.size > 0 || pendingRemoved.size > 0;

	btnRemove.disabled = !hasSelection;
	btnApply.disabled = !hasPending;

	btnAdd.disabled = isAddingMode;
	btnStop.disabled = !isAddingMode;
}

// 多选处理（Ctrl/Shift）
function handleItemClick(idx, event) {
	const ctrlKey = event.ctrlKey || event.metaKey;
	const shiftKey = event.shiftKey;

	if (shiftKey && lastClickIndex >= 0 && lastClickIndex < activeNetworkNames.length) {
		const start = Math.min(lastClickIndex, idx);
		const end = Math.max(lastClickIndex, idx);
		if (!ctrlKey)
			selectedIndices.clear();
		for (let i = start; i <= end; i++) selectedIndices.add(i);
	}
	else if (ctrlKey) {
		if (selectedIndices.has(idx)) {
			selectedIndices.delete(idx);
			if (lastClickIndex === idx)
				lastClickIndex = -1;
		}
		else {
			selectedIndices.add(idx);
			lastClickIndex = idx;
		}
	}
	else {
		const wasOnlyThis = selectedIndices.size === 1 && selectedIndices.has(idx);
		selectedIndices.clear();
		if (!wasOnlyThis)
			selectedIndices.add(idx);
		lastClickIndex = selectedIndices.has(idx) ? idx : -1;
	}
	applyFilterAndRender();
}

// ==================== 按钮逻辑 ====================
// 开始添加（留白监听函数）
btnAdd.addEventListener('click', () => {
	if (isAddingMode)
		return;
	isAddingMode = true;
	// 用户可在此处绑定外部事件监听，通过调用 addNetworkName(name) 添加网络名
	startAdding();
	showToast('已开启添加模式，可调用 addNetworkName(name) 添加网络名');
	updateButtonStates();
});

// 停止（留白监听函数）
btnStop.addEventListener('click', () => {
	if (!isAddingMode)
		return;
	isAddingMode = false;
	stopAdding();
	showToast('已停止添加模式');
	updateButtonStates();
});

// 移除按钮：切换待删除状态
btnRemove.addEventListener('click', () => {
	if (selectedIndices.size === 0)
		return;

	// 统计当前选中项的状态，决定整体操作（如果全部已待删除则取消，否则标记为待删除）
	const selectedNames = [];
	for (const idx of selectedIndices) {
		const name = activeNetworkNames[idx];
		if (name)
			selectedNames.push(name);
	}

	const allPendingRemoved = selectedNames.every(n => pendingRemoved.has(n));
	const allPendingAdded = selectedNames.every(n => pendingAdded.has(n));

	if (allPendingRemoved) {
		// 全部已待删除：取消待删除
		selectedNames.forEach(n => pendingRemoved.delete(n));
	}
	else if (allPendingAdded) {
		// 全部是新添加的：从pendingAdded中移除，同时从currentNetworkNames中删除（因为这些是临时添加）
		selectedNames.forEach((n) => {
			pendingAdded.delete(n);
			const idxInSource = currentNetworkNames.indexOf(n);
			if (idxInSource !== -1)
				currentNetworkNames.splice(idxInSource, 1);
		});
	}
	else {
		// 混合状态：将未待删除的标记为待删除，已待删除的不变（或取消？按需求简化：标记所有为待删除）
		selectedNames.forEach((n) => {
			if (!pendingRemoved.has(n)) {
				// 如果它在新添加集合中，先移除新添加标记再标记为待删除（逻辑上不能同时存在）
				if (pendingAdded.has(n)) {
					pendingAdded.delete(n);
					// 从数据源中移除该添加项（因为还没应用）
					const idx = currentNetworkNames.indexOf(n);
					if (idx !== -1)
						currentNetworkNames.splice(idx, 1);
				}
				else {
					pendingRemoved.add(n);
				}
			}
		});
	}

	selectedIndices.clear();
	lastClickIndex = -1;
	applyFilterAndRender();
	// showToast('操作已更新');
});

// 应用按钮：提交所有临时更改（数据同步部分留白）
btnApply.addEventListener('click', () => {
	// 执行删除
	for (const name of pendingRemoved) {
		const idx = currentNetworkNames.indexOf(name);
		if (idx !== -1)
			currentNetworkNames.splice(idx, 1);
	}
	// 新添加的网络名保留在currentNetworkNames中（已添加过）
	// 清空临时集合
	pendingAdded.clear();
	pendingRemoved.clear();
	// 用户可在此处同步数据至后端/本地存储等
	applyChanges();
	showToast('更改已应用');
	applyFilterAndRender();
});

// ==================== 提供给外部的添加函数（在监听中调用） ====================
function addNetworkName(name) {
	if (!isAddingMode) {
		console.warn('未开启添加模式，忽略添加操作');
		return;
	}
	if (!currentCategoryName) {
		showToast('请先选择一个网络类/组');
		return;
	}
	// 如果已存在且不在待删除中，则不重复添加
	if (currentNetworkNames.includes(name) && !pendingRemoved.has(name)) {
		showToast('网络名已存在');
		return;
	}
	// 如果处于待删除状态，移除待删除并加入待添加
	if (pendingRemoved.has(name)) {
		pendingRemoved.delete(name);
	}
	// 加入数据列表和待添加集合
	if (!currentNetworkNames.includes(name)) {
		currentNetworkNames.push(name);
	}
	pendingAdded.add(name);
	selectedIndices.clear();
	lastClickIndex = -1;
	applyFilterAndRender();
	// showToast(`已临时添加: ${name}`);
}

// 留白函数（用户可覆盖）
function startAdding() {
	// 用户可在此绑定事件监听，例如 window.addEventListener('customEvent', handler)
	const a = prompt('请输入网络名'); // eslint-disable-line	no-alert
	if (a)
		addNetworkName(a);
}
function stopAdding() {
	// 用户可在此移除事件监听
}
function applyChanges() {
	// 用户可在此同步数据到数据源，例如发送请求或更新dataMap
}

// ==================== Combobox事件 ====================
comboboxInput.addEventListener('focus', () => {
	openDropdown(); // 显示全部
});

comboboxInput.addEventListener('input', () => {
	const val = comboboxInput.value.trim().toLowerCase();
	openDropdown(val); // 根据输入筛选
	// 自动匹配
	const options = getCategoryOptions();
	const exact = options.find(opt => opt.toLowerCase() === val);
	if (exact && exact !== currentCategoryName) {
		selectCategory(exact);
		closeDropdown();
		comboboxInput.blur();
	}
});

comboboxArrow.addEventListener('mousedown', (e) => {
	e.stopPropagation();
	e.preventDefault();
	if (comboboxDropdown.classList.contains('open')) {
		closeDropdown();
	}
	else {
		comboboxInput.focus();
		openDropdown();
	}
});

comboboxInput.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		closeDropdown();
		comboboxInput.blur();
	}
	else if (e.key === 'Enter') {
		const val = comboboxInput.value.trim().toLowerCase();
		const options = getCategoryOptions();
		const exact = options.find(opt => opt.toLowerCase() === val);
		if (exact)
			selectCategory(exact);
		closeDropdown();
		comboboxInput.blur();
		e.preventDefault();
	}
	else if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (!comboboxDropdown.classList.contains('open'))
			openDropdown();
		// 为所有选项添加 tabindex 使其可聚焦（只需执行一次，避免重复设置）
		const items = comboboxDropdown.querySelectorAll('li:not(.no-match)');
		items.forEach(item => item.setAttribute('tabindex', '-1'));
		const first = items[0];
		if (first)
			first.focus();

		// 在下拉框上绑定键盘事件，处理后续的上下移动和回车选择（仅绑定一次）
		if (!comboboxDropdown?._dropdownKeyBound) {
			comboboxDropdown._dropdownKeyBound = true;
			comboboxDropdown.addEventListener('keydown', (ev) => {
				if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
					ev.preventDefault();
					const current = document.activeElement;
					const siblings = Array.from(comboboxDropdown.querySelectorAll('li:not(.no-match)'));
					const index = siblings.indexOf(current);
					if (index === -1)
						return;
					let next;
					if (ev.key === 'ArrowDown') {
						next = siblings[index + 1] || siblings[0];
					}
					else {
						next = siblings[index - 1] || siblings[siblings.length - 1];
					}
					if (next)
						next.focus();
				}
				else if (ev.key === 'Enter') {
					ev.preventDefault();
					const active = document.activeElement;
					if (active && active.tagName === 'LI' && !active.classList.contains('no-match')) {
						const value = active.dataset.value;
						if (value)
							selectCategory(value);
						closeDropdown();
						comboboxInput.blur();
					}
				}
				else if (ev.key === 'Escape') {
					closeDropdown();
					comboboxInput.focus();
				}
			});
		}
	}
});

comboboxWrapper.addEventListener('focusout', () => {
	// 延迟到新焦点确定后再判断
	setTimeout(() => {
		if (!comboboxWrapper.contains(document.activeElement)) {
			// 焦点已离开整个下拉组件，执行恢复与关闭
			const val = comboboxInput.value.trim();
			const options = getCategoryOptions();
			const exact = options.find(opt => opt.toLowerCase() === val.toLowerCase());
			if (exact && exact !== currentCategoryName) {
				selectCategory(exact);
			}
			else if (!exact && currentCategoryName && val !== currentCategoryName) {
				comboboxInput.value = currentCategoryName || '';
			}
			else if (!exact && !currentCategoryName) {
				comboboxInput.value = '';
			}
			closeDropdown();
		}
	}, 100);
});

document.addEventListener('mousedown', (e) => {
	if (!comboboxWrapper.contains(e.target)) {
		closeDropdown();
		if (currentCategoryName && comboboxInput.value !== currentCategoryName) {
			comboboxInput.value = currentCategoryName;
		}
		if (!currentCategoryName && comboboxInput.value.trim()) {
			const options = getCategoryOptions();
			const exact = options.find(opt => opt.toLowerCase() === comboboxInput.value.trim().toLowerCase());
			if (!exact)
				comboboxInput.value = '';
		}
	}
});

// 筛选框
filterInput.addEventListener('input', applyFilterAndRender);

// 列表空白取消选中
listContainer.addEventListener('mousedown', (e) => {
	if (e.target === listContainer || e.target === listInner) {
		if (selectedIndices.size > 0) {
			selectedIndices.clear();
			lastClickIndex = -1;
			applyFilterAndRender();
		}
	}
});

// 单选按钮切换（带记忆，丢弃临时更改）
function switchCategoryType(newType) {
	if (currentCategoryType === newType)
		return;
	// 丢弃当前所有临时更改
	pendingAdded.clear();
	pendingRemoved.clear();
	selectedIndices.clear();
	lastClickIndex = -1;

	currentCategoryType = newType;
	// 尝试恢复记忆的组名
	const remembered = lastSelectedGroup[newType];
	if (remembered && dataMap[newType][remembered]) {
		currentCategoryName = remembered;
		comboboxInput.value = remembered;
		currentNetworkNames = [...dataMap[newType][remembered]];
	}
	else {
		currentCategoryName = null;
		currentNetworkNames = [];
		comboboxInput.value = '';
	}
	filterInput.value = '';
	applyFilterAndRender();
}

radioNetClass.addEventListener('change', () => {
	if (radioNetClass.checked)
		switchCategoryType('netClass');
});
radioNetGroup.addEventListener('change', () => {
	if (radioNetGroup.checked)
		switchCategoryType('netGroup');
});

// 初始化
function init() {
	currentCategoryType = 'netClass';
	radioNetClass.checked = true;
	radioNetGroup.checked = false;

	currentCategoryName = null;
	comboboxInput.value = '';
	currentNetworkNames = [];

	pendingAdded.clear();
	pendingRemoved.clear();
	selectedIndices.clear();
	lastClickIndex = -1;
	isAddingMode = false;
	filterInput.value = '';
	closeDropdown();
	applyFilterAndRender();
}

init();
