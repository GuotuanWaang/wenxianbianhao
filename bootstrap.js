var CollectionNumberingPluginInstance;

const ADDON_NAME = "分类文献编号";
const TOOLS_MENUITEM_ID = "collection-numbering-tools-menuitem";
const CONTEXT_MENUITEM_ID = "collection-numbering-context-menuitem";
const CONTEXT_SEPARATOR_ID = "collection-numbering-context-separator";
const NUMBER_COLUMN_BASE_KEY = "numberBeforeCreator";
const EXTRA_NUMBER_KEY = "CollectionNumber";
const YIELD_EVERY = 120;
const MAX_PAD_LENGTH = 12;

function log(message) {
	Zotero.debug(ADDON_NAME + ": " + message);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log("Starting " + version);
	CollectionNumberingPluginInstance = new CollectionNumberingPlugin({ id, version, rootURI });
	CollectionNumberingPluginInstance.registerNumberColumn();
	CollectionNumberingPluginInstance.addToAllWindows();
}

function onMainWindowLoad({ window }) {
	if (CollectionNumberingPluginInstance) {
		CollectionNumberingPluginInstance.addToWindow(window);
	}
}

function onMainWindowUnload({ window }) {
	if (CollectionNumberingPluginInstance) {
		CollectionNumberingPluginInstance.removeFromWindow(window);
	}
}

function shutdown() {
	log("Shutting down");
	if (CollectionNumberingPluginInstance) {
		CollectionNumberingPluginInstance.unregisterNumberColumn();
		CollectionNumberingPluginInstance.removeFromAllWindows();
		CollectionNumberingPluginInstance = undefined;
	}
}

function uninstall() {
	log("Uninstalled");
}

function CollectionNumberingPlugin(context) {
	this.id = context.id;
	this.version = context.version;
	this.rootURI = context.rootURI;
	this._windowHooks = new WeakMap();
	this._numberColumnDataKey = null;
}

CollectionNumberingPlugin.prototype.addToAllWindows = function () {
	for (let window of Zotero.getMainWindows()) {
		this.addToWindow(window);
	}
};

CollectionNumberingPlugin.prototype.removeFromAllWindows = function () {
	for (let window of Zotero.getMainWindows()) {
		this.removeFromWindow(window);
	}
};

CollectionNumberingPlugin.prototype.addToWindow = function (window) {
	if (!window || !window.document) {
		return;
	}
	if (this._windowHooks.has(window)) {
		return;
	}

	let document = window.document;
	let onCommand = async () => {
		await this.runFromWindow(window);
	};

	let toolsMenuItem = null;
	let toolsPopup = document.getElementById("menu_ToolsPopup");
	if (toolsPopup && !document.getElementById(TOOLS_MENUITEM_ID)) {
		toolsMenuItem = this._createMenuItem(document);
		toolsMenuItem.id = TOOLS_MENUITEM_ID;
		toolsMenuItem.className = "menu-type-library";
		toolsMenuItem.setAttribute("label", "对所选分类文献编号...");
		toolsMenuItem.addEventListener("command", onCommand);
		toolsPopup.appendChild(toolsMenuItem);
	}

	let contextMenuItem = null;
	let contextSeparator = null;
	let onContextPopupShowing = null;
	let contextPopup = document.getElementById("zotero-collectionmenu");
	if (contextPopup && !document.getElementById(CONTEXT_MENUITEM_ID)) {
		contextSeparator = this._createSeparator(document);
		contextSeparator.id = CONTEXT_SEPARATOR_ID;
		contextSeparator.hidden = true;

		contextMenuItem = this._createMenuItem(document);
		contextMenuItem.id = CONTEXT_MENUITEM_ID;
		contextMenuItem.setAttribute("label", "对该分类文献编号...");
		contextMenuItem.hidden = true;
		contextMenuItem.addEventListener("command", onCommand);

		onContextPopupShowing = () => {
			let hasCollection = !!this._getSelectedCollection(window);
			contextMenuItem.hidden = !hasCollection;
			contextSeparator.hidden = !hasCollection;
			contextMenuItem.disabled = !hasCollection;
		};
		contextPopup.addEventListener("popupshowing", onContextPopupShowing);
		contextPopup.appendChild(contextSeparator);
		contextPopup.appendChild(contextMenuItem);
	}

	this._windowHooks.set(window, {
		onCommand,
		onContextPopupShowing,
		toolsMenuItem,
		contextMenuItem,
		contextSeparator
	});

	this._ensureNumberColumnBeforeCreator(window).catch(error => {
		log("Failed to position number column: " + this._errorText(error));
	});
};

CollectionNumberingPlugin.prototype.registerNumberColumn = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.registerColumn) {
		log("ItemTreeManager is not available; skip number column registration");
		return;
	}

	let registeredDataKey = Zotero.ItemTreeManager.registerColumn({
		dataKey: NUMBER_COLUMN_BASE_KEY,
		label: "编号",
		pluginID: this.id,
		enabledTreeIDs: ["main"],
		showInColumnPicker: true,
		width: "80",
		staticWidth: true,
		zoteroPersist: ["width", "hidden", "sortDirection"],
		dataProvider: (item) => this._getStoredNumber(item)
	});

	if (!registeredDataKey) {
		registeredDataKey = this._findRegisteredNumberColumnDataKey();
	}
	if (!registeredDataKey) {
		log("Failed to register number column");
		return;
	}

	this._numberColumnDataKey = registeredDataKey;
	if (Zotero.ItemTreeManager.refreshColumns) {
		Zotero.ItemTreeManager.refreshColumns();
	}
};

CollectionNumberingPlugin.prototype.unregisterNumberColumn = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.unregisterColumn) {
		return;
	}

	let dataKey = this._numberColumnDataKey || this._findRegisteredNumberColumnDataKey();
	if (!dataKey) {
		return;
	}

	Zotero.ItemTreeManager.unregisterColumn(dataKey);
	this._numberColumnDataKey = null;
	if (Zotero.ItemTreeManager.refreshColumns) {
		Zotero.ItemTreeManager.refreshColumns();
	}
};

CollectionNumberingPlugin.prototype._findRegisteredNumberColumnDataKey = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.getCustomColumns) {
		return null;
	}

	let columns = Zotero.ItemTreeManager.getCustomColumns("main", { pluginID: this.id }) || [];
	let expectedSuffix = "-" + NUMBER_COLUMN_BASE_KEY;
	let targetColumn = columns.find(column => {
		return column && typeof column.dataKey === "string" && column.dataKey.endsWith(expectedSuffix);
	});
	return targetColumn ? targetColumn.dataKey : null;
};

CollectionNumberingPlugin.prototype._ensureNumberColumnBeforeCreator = async function (window) {
	if (!this._numberColumnDataKey || !window || !window.ZoteroPane || !window.ZoteroPane.itemsView) {
		return;
	}

	let itemsView = window.ZoteroPane.itemsView;
	if (!itemsView.waitForLoad || !itemsView._getColumns) {
		return;
	}
	await itemsView.waitForLoad();

	if (!itemsView.tree || !itemsView.tree._columns) {
		return;
	}

	let columns = itemsView._getColumns();
	let numberIndex = columns.findIndex(column => column.dataKey === this._numberColumnDataKey);
	if (numberIndex === -1) {
		return;
	}

	if (columns[numberIndex].hidden) {
		itemsView.tree._columns.toggleHidden(numberIndex);
		columns = itemsView._getColumns();
		numberIndex = columns.findIndex(column => column.dataKey === this._numberColumnDataKey);
		if (numberIndex === -1) {
			return;
		}
	}

	let creatorIndex = columns.findIndex(column => column.dataKey === "firstCreator");
	if (creatorIndex === -1) {
		return;
	}
	if (numberIndex !== creatorIndex - 1) {
		itemsView.tree._columns.setOrder(numberIndex, creatorIndex);
	}
};

CollectionNumberingPlugin.prototype.removeFromWindow = function (window) {
	if (!window || !window.document) {
		return;
	}

	let document = window.document;
	let hooks = this._windowHooks.get(window);

	let toolsMenuItem = document.getElementById(TOOLS_MENUITEM_ID);
	if (toolsMenuItem) {
		if (hooks && hooks.onCommand) {
			toolsMenuItem.removeEventListener("command", hooks.onCommand);
		}
		toolsMenuItem.remove();
	}

	let contextMenuItem = document.getElementById(CONTEXT_MENUITEM_ID);
	if (contextMenuItem) {
		if (hooks && hooks.onCommand) {
			contextMenuItem.removeEventListener("command", hooks.onCommand);
		}
		contextMenuItem.remove();
	}

	let contextSeparator = document.getElementById(CONTEXT_SEPARATOR_ID);
	if (contextSeparator) {
		contextSeparator.remove();
	}

	let contextPopup = document.getElementById("zotero-collectionmenu");
	if (contextPopup && hooks && hooks.onContextPopupShowing) {
		contextPopup.removeEventListener("popupshowing", hooks.onContextPopupShowing);
	}

	if (hooks) {
		this._windowHooks.delete(window);
	}
};

CollectionNumberingPlugin.prototype.runFromWindow = async function (window) {
	try {
		let selectedCollection = this._getSelectedCollection(window);
		if (!selectedCollection) {
			Services.prompt.alert(
				window,
				ADDON_NAME,
				"请先在左侧面板选择一个分类。"
			);
			return;
		}

		let options = this._promptOptions(window, selectedCollection);
		if (!options) {
			return;
		}

		let result = await this._numberItems(selectedCollection, options);
		this._showSummary(window, selectedCollection, options, result);
	}
	catch (error) {
		this._showErrorWindow(window, "执行文献编号失败", error);
	}
};

CollectionNumberingPlugin.prototype._promptOptions = function (window, collection) {
	let collectionPath = this._getCollectionPath(collection);
	let includeSubcollectionsState = { value: false };

		let proceed = Services.prompt.confirmCheck(
			window,
			ADDON_NAME,
			[
				"将对下列分类中的文献进行编号，并写入插件专用字段：",
				"`extra` -> `" + EXTRA_NUMBER_KEY + "`",
				collectionPath,
				"",
				"点击“确定”继续设置参数。"
			].join("\n"),
			"包含子分类",
		includeSubcollectionsState
	);
	if (!proceed) {
		return null;
	}

	let startNumber = this._promptInteger(
		window,
		"起始编号",
		"请输入起始编号（正整数）：",
		"1",
		1,
		999999999
	);
	if (startNumber === null) {
		return null;
	}

	let padLength = this._promptInteger(
		window,
		"补零位数",
		"请输入补零位数（0-" + MAX_PAD_LENGTH + "，0 表示不补零）：",
		"3",
		0,
		MAX_PAD_LENGTH
	);
	if (padLength === null) {
		return null;
	}

	let prefix = this._promptString(
		window,
		"编号前缀",
		"请输入编号前缀（可留空）：",
		""
	);
	if (prefix === null) {
		return null;
	}

	let overwriteState = { value: false };
		let confirmRun = Services.prompt.confirmCheck(
			window,
			ADDON_NAME,
			[
				"是否开始执行编号？",
				"",
				"若不覆盖已有编号，则已有插件编号（extra/" + EXTRA_NUMBER_KEY + "）的条目会被跳过。"
			].join("\n"),
			"覆盖已有插件编号（extra/" + EXTRA_NUMBER_KEY + "）",
			overwriteState
		);
	if (!confirmRun) {
		return null;
	}

	return {
		includeSubcollections: includeSubcollectionsState.value,
		startNumber,
		padLength,
		prefix: prefix.trim(),
		overwriteExisting: overwriteState.value
	};
};

CollectionNumberingPlugin.prototype._promptInteger = function (window, title, message, defaultValue, min, max) {
	let attempts = 0;
	while (attempts < 3) {
		let input = { value: defaultValue };
		let confirmed = Services.prompt.prompt(
			window,
			ADDON_NAME + " - " + title,
			message,
			input,
			null,
			{}
		);
		if (!confirmed) {
			return null;
		}

		let raw = (input.value || "").trim();
		if (/^\d+$/.test(raw)) {
			let value = Number(raw);
			if (value >= min && value <= max) {
				return value;
			}
		}

		Services.prompt.alert(
			window,
			ADDON_NAME,
			"输入无效，请输入 " + min + " 到 " + max + " 之间的整数。"
		);
		attempts++;
	}

	throw new Error(title + " 输入超过最大重试次数");
};

CollectionNumberingPlugin.prototype._promptString = function (window, title, message, defaultValue) {
	let input = { value: defaultValue };
	let confirmed = Services.prompt.prompt(
		window,
		ADDON_NAME + " - " + title,
		message,
		input,
		null,
		{}
	);
	if (!confirmed) {
		return null;
	}
	return input.value || "";
};

CollectionNumberingPlugin.prototype._numberItems = async function (selectedCollection, options) {
	let scopeCollections = this._collectScopeCollections(selectedCollection, options.includeSubcollections);
	let allItems = [];
	let seenItemIDs = new Set();

	for (let collection of scopeCollections) {
		let childItems = collection.getChildItems(false, false);
		for (let item of childItems) {
			if (!item || !item.isRegularItem || !item.isRegularItem()) {
				continue;
			}
			if (seenItemIDs.has(item.id)) {
				continue;
			}
			seenItemIDs.add(item.id);
			allItems.push(item);
		}
	}

	let nextNumber = options.startNumber;
	let updatedCount = 0;
	let skippedExistingCount = 0;
	let failedItems = [];

	for (let i = 0; i < allItems.length; i++) {
		let item = allItems[i];
		let currentValue = this._getStoredNumber(item);
		if (currentValue && !options.overwriteExisting) {
			skippedExistingCount++;
			continue;
		}

		try {
			let sequence = this._formatNumber(nextNumber, options.padLength);
			let numberedValue = options.prefix ? options.prefix + sequence : sequence;
			this._setStoredNumber(item, numberedValue);
			await item.saveTx();
			nextNumber++;
			updatedCount++;
		}
		catch (error) {
			failedItems.push({
				id: item.id,
				title: this._stringField(item, "title"),
				error: this._errorText(error)
			});
		}

		if ((i + 1) % YIELD_EVERY === 0) {
			await this._yieldToUI();
		}
	}

	return {
		scopeCollectionCount: scopeCollections.length,
		totalRegularItems: allItems.length,
		updatedCount,
		skippedExistingCount,
		failedItems,
		startNumber: options.startNumber,
		lastAssignedNumber: updatedCount > 0 ? nextNumber - 1 : null
	};
};

CollectionNumberingPlugin.prototype._showSummary = function (window, selectedCollection, options, result) {
	let lines = [
		"文献编号完成。",
		"",
		"分类：" + this._getCollectionPath(selectedCollection),
		"范围分类数：" + result.scopeCollectionCount,
		"扫描常规文献：" + result.totalRegularItems,
		"成功写入：" + result.updatedCount,
		"跳过（已有插件编号）：" + result.skippedExistingCount,
		"失败：" + result.failedItems.length,
		"",
		"规则：",
		"- 存储位置：extra -> " + EXTRA_NUMBER_KEY,
		"- 起始编号：" + options.startNumber,
		"- 补零位数：" + options.padLength,
		"- 前缀：" + (options.prefix || "（无）"),
		"- 覆盖已有编号：" + (options.overwriteExisting ? "是" : "否"),
		"- 包含子分类：" + (options.includeSubcollections ? "是" : "否")
	];

	if (result.lastAssignedNumber !== null) {
		lines.push("- 最后编号：" + result.lastAssignedNumber);
	}

	if (result.failedItems.length) {
		lines.push("");
		lines.push("失败条目（最多显示 5 条）：");
		let max = Math.min(result.failedItems.length, 5);
		for (let i = 0; i < max; i++) {
			let entry = result.failedItems[i];
			lines.push("- [" + entry.id + "] " + (entry.title || "（无标题）"));
		}
	}

	Services.prompt.alert(window, ADDON_NAME, lines.join("\n"));
};

CollectionNumberingPlugin.prototype._collectScopeCollections = function (rootCollection, includeSubcollections) {
	if (!includeSubcollections) {
		return [rootCollection];
	}

	let collections = [];
	let queue = [rootCollection];
	let seen = new Set();
	while (queue.length) {
		let collection = queue.shift();
		if (!collection || seen.has(collection.id)) {
			continue;
		}
		seen.add(collection.id);
		collections.push(collection);

		let children = collection.getChildCollections(false, false);
		for (let child of children) {
			queue.push(child);
		}
	}
	return collections;
};

CollectionNumberingPlugin.prototype._formatNumber = function (numberValue, padLength) {
	let base = String(numberValue);
	if (!padLength) {
		return base;
	}
	return base.padStart(padLength, "0");
};

CollectionNumberingPlugin.prototype._getStoredNumber = function (item) {
	let extra = this._stringField(item, "extra");
	if (!extra) {
		return "";
	}
	let keyPrefix = (EXTRA_NUMBER_KEY + ":").toLowerCase();
	let lines = extra.split(/\r?\n/);
	for (let line of lines) {
		let trimmed = (line || "").trim();
		if (!trimmed) {
			continue;
		}
		if (trimmed.toLowerCase().startsWith(keyPrefix)) {
			return trimmed.slice(EXTRA_NUMBER_KEY.length + 1).trim();
		}
	}
	return "";
};

CollectionNumberingPlugin.prototype._setStoredNumber = function (item, value) {
	let extra = this._stringField(item, "extra");
	let lines = extra ? extra.split(/\r?\n/) : [];
	let keyPrefix = (EXTRA_NUMBER_KEY + ":").toLowerCase();
	let filtered = [];

	for (let line of lines) {
		let trimmed = (line || "").trim();
		if (trimmed.toLowerCase().startsWith(keyPrefix)) {
			continue;
		}
		filtered.push(line);
	}

	while (filtered.length && !filtered[filtered.length - 1].trim()) {
		filtered.pop();
	}

	filtered.push(EXTRA_NUMBER_KEY + ": " + value);
	item.setField("extra", filtered.join("\n"));
};

CollectionNumberingPlugin.prototype._createMenuItem = function (document) {
	if (document.createXULElement) {
		return document.createXULElement("menuitem");
	}
	return document.createElement("menuitem");
};

CollectionNumberingPlugin.prototype._createSeparator = function (document) {
	if (document.createXULElement) {
		return document.createXULElement("menuseparator");
	}
	return document.createElement("menuseparator");
};

CollectionNumberingPlugin.prototype._getSelectedCollection = function (window) {
	if (!window || !window.ZoteroPane || !window.ZoteroPane.getSelectedCollection) {
		return null;
	}
	return window.ZoteroPane.getSelectedCollection();
};

CollectionNumberingPlugin.prototype._stringField = function (item, fieldName) {
	if (!item || !item.getField) {
		return "";
	}
	let value = item.getField(fieldName);
	return value ? String(value).trim() : "";
};

CollectionNumberingPlugin.prototype._getCollectionPath = function (collection) {
	if (!collection) {
		return "";
	}
	let parts = [collection.name || "（未命名分类）"];
	let currentParentID = collection.parentID;
	while (currentParentID) {
		let parent = Zotero.Collections.get(currentParentID);
		if (!parent) {
			break;
		}
		parts.unshift(parent.name || "（未命名分类）");
		currentParentID = parent.parentID;
	}
	let library = Zotero.Libraries.get(collection.libraryID);
	let path = parts.join(" / ");
	if (library && library.name) {
		return library.name + " / " + path;
	}
	return path;
};

CollectionNumberingPlugin.prototype._yieldToUI = async function () {
	await new Promise(resolve => {
		Services.tm.dispatchToMainThread(resolve);
	});
};

CollectionNumberingPlugin.prototype._showErrorWindow = function (parentWindow, title, error) {
	let message = title + "\n\n" + this._errorText(error);
	try {
		let errorWindow = parentWindow.openDialog(
			"about:blank",
			"",
			"chrome,resizable,centerscreen,width=900,height=520"
		);
		let render = () => {
			let document = errorWindow.document;
			errorWindow.document.title = ADDON_NAME + " - 错误";
			let body = document.body || document.createElement("body");
			if (!document.body) {
				document.documentElement.appendChild(body);
			}
			body.innerHTML = "";

			let style = document.createElement("style");
			style.textContent = "body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;margin:12px;}pre{white-space:pre-wrap;}";
			document.head.appendChild(style);

			let pre = document.createElement("pre");
			pre.textContent = message;
			body.appendChild(pre);
		};
		if (errorWindow.document && errorWindow.document.readyState === "complete") {
			render();
		}
		else {
			errorWindow.addEventListener("load", render, { once: true });
		}
	}
	catch (windowError) {
		Services.prompt.alert(parentWindow, ADDON_NAME, message);
	}
};

CollectionNumberingPlugin.prototype._errorText = function (error) {
	if (!error) {
		return "未知错误";
	}
	let text = "" + error;
	if (error.stack) {
		text += "\n\n堆栈：\n" + error.stack;
	}
	return text;
};
