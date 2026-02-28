var CollectionNumberingPluginInstance;

const ADDON_NAME = "分类文献编号";
const TOOLS_MENUITEM_ID = "collection-numbering-tools-menuitem";
const TOOLS_TRANSLATE_MENUITEM_ID = "collection-numbering-tools-translate-menuitem";
const TOOLS_CONFIG_MENUITEM_ID = "collection-numbering-tools-config-menuitem";
const CONTEXT_MENUITEM_ID = "collection-numbering-context-menuitem";
const CONTEXT_TRANSLATE_MENUITEM_ID = "collection-numbering-context-translate-menuitem";
const CONTEXT_SEPARATOR_ID = "collection-numbering-context-separator";
const NUMBER_COLUMN_BASE_KEY = "numberBeforeCreator";
const TRANSLATION_COLUMN_BASE_KEY = "translatedTitle";
const EXTRA_NUMBER_KEY = "CollectionNumber";
const LEGACY_TRANSLATION_EXTRA_KEY = "TitleZh";
const TRANSLATION_RELATION_PREDICATE = "https://local.collection-numbering.plugin/relation/title-translation";
const TRANSLATION_RELATION_VALUE_PREFIX = "zotero://collection-numbering/translation/";
const TRANSLATION_NOTE_MARKER = "collection-numbering-translation-note";
const PREF_PREFIX = "extensions.collection-numbering.";
const PREF_API_KEY = "apiKey";
const PREF_API_ENDPOINT = "apiEndpoint";
const PREF_API_MODEL = "apiModel";
const DEFAULT_API_ENDPOINT = "https://api.deepseek.com";
const DEFAULT_API_MODEL = "deepseek-chat";
const PREFERENCE_PANE_KEY = "collection-numbering-prefpane";
const PREFERENCE_PANE_LABEL = "分类文献编号";
const YIELD_EVERY = 120;
const MAX_PAD_LENGTH = 12;
const TRANSLATE_TIMEOUT_MS = 30000;

function log(message) {
	Zotero.debug(ADDON_NAME + ": " + message);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log("Starting " + version);
	CollectionNumberingPluginInstance = new CollectionNumberingPlugin({ id, version, rootURI });
	if (Zotero.initializationPromise) {
		await Zotero.initializationPromise;
	}
	if (Zotero.uiReadyPromise) {
		await Zotero.uiReadyPromise;
	}
	CollectionNumberingPluginInstance.init();
	CollectionNumberingPluginInstance.registerNumberColumn();
	CollectionNumberingPluginInstance.registerTranslationColumn();
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
		CollectionNumberingPluginInstance.unregisterTranslationColumn();
		CollectionNumberingPluginInstance.uninit();
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
	this._translationColumnDataKey = null;
	this.preferencePaneID = null;
	this.preferencePaneKey = PREFERENCE_PANE_KEY;
	this.preferencePaneRegistering = false;
	this.preferencePaneRetryCount = 0;
	this.preferencePaneRetryMax = 60;
	this.preferencePaneRetryTimer = null;
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

CollectionNumberingPlugin.prototype.init = function () {
	Zotero.CollectionNumbering = this;
	this.registerPreferencePane();
};

CollectionNumberingPlugin.prototype.uninit = function () {
	if (
		this.preferencePaneID &&
		Zotero.PreferencePanes &&
		typeof Zotero.PreferencePanes.unregister === "function"
	) {
		try {
			Zotero.PreferencePanes.unregister(this.preferencePaneID);
		}
		catch (error) {}
		this.preferencePaneID = null;
	}

	if (this.preferencePaneRetryTimer) {
		clearTimeout(this.preferencePaneRetryTimer);
		this.preferencePaneRetryTimer = null;
	}
	this.preferencePaneRegistering = false;
	this.preferencePaneRetryCount = 0;

	if (Zotero.CollectionNumbering === this) {
		delete Zotero.CollectionNumbering;
	}
};

CollectionNumberingPlugin.prototype.registerPreferencePane = function () {
	if (this.preferencePaneID || this.preferencePaneRegistering) {
		return;
	}

	if (!Zotero.PreferencePanes || typeof Zotero.PreferencePanes.register !== "function") {
		if (this.preferencePaneRetryCount < this.preferencePaneRetryMax) {
			this.preferencePaneRetryCount++;
			this.preferencePaneRetryTimer = setTimeout(() => {
				this.preferencePaneRetryTimer = null;
				this.registerPreferencePane();
			}, 1000);
		}
		return;
	}

	let pluginID = this.id || "collection-numbering@example.com";

	if (Array.isArray(Zotero.PreferencePanes.pluginPanes)) {
		let paneIDsToClear = Zotero.PreferencePanes.pluginPanes
			.filter((pane) => pane && (pane.id === this.preferencePaneKey || pane.pluginID === pluginID))
			.map((pane) => pane.id)
			.filter(Boolean);

		for (let paneID of paneIDsToClear) {
			try {
				Zotero.PreferencePanes.unregister(paneID);
			}
			catch (error) {}
		}
	}

	this.preferencePaneRegistering = true;
	Zotero.PreferencePanes.register({
		pluginID: pluginID,
		id: this.preferencePaneKey,
		src: "addon/chrome/content/preferencesPane.xhtml",
		image: "icons/icon-32.png",
		label: PREFERENCE_PANE_LABEL
	}).then((paneID) => {
		this.preferencePaneID = paneID;
		this.preferencePaneRetryCount = 0;
	}).catch((error) => {
		Zotero.logError(error);
		this._syncExistingPreferencePane();
	}).finally(() => {
		this.preferencePaneRegistering = false;
	});
};

CollectionNumberingPlugin.prototype._syncExistingPreferencePane = function () {
	if (!Zotero.PreferencePanes || !Array.isArray(Zotero.PreferencePanes.pluginPanes)) {
		return;
	}

	let pluginID = this.id || "collection-numbering@example.com";
	let matched = Zotero.PreferencePanes.pluginPanes.filter((pane) => {
		return pane && (pane.id === this.preferencePaneKey || pane.pluginID === pluginID);
	});
	if (matched.length) {
		this.preferencePaneID = this.preferencePaneKey;
	}
};

CollectionNumberingPlugin.prototype.addToWindow = function (window) {
	if (!window || !window.document) {
		return;
	}
	if (this._windowHooks.has(window)) {
		return;
	}
	this.registerPreferencePane();

	let document = window.document;
	let onCommand = async () => {
		await this.runFromWindow(window);
	};
	let onTranslateCommand = async () => {
		await this.runTranslateFromWindow(window);
	};
	let onConfigCommand = () => {
		this.openConfigFromWindow(window);
	};

	let toolsMenuItem = null;
	let toolsTranslateMenuItem = null;
	let toolsConfigMenuItem = null;
	let toolsPopup = document.getElementById("menu_ToolsPopup");
	if (toolsPopup && !document.getElementById(TOOLS_MENUITEM_ID)) {
		toolsMenuItem = this._createMenuItem(document);
		toolsMenuItem.id = TOOLS_MENUITEM_ID;
		toolsMenuItem.className = "menu-type-library";
		toolsMenuItem.setAttribute("label", "对所选分类文献编号...");
		toolsMenuItem.addEventListener("command", onCommand);
		toolsPopup.appendChild(toolsMenuItem);
	}
	if (toolsPopup && !document.getElementById(TOOLS_TRANSLATE_MENUITEM_ID)) {
		toolsTranslateMenuItem = this._createMenuItem(document);
		toolsTranslateMenuItem.id = TOOLS_TRANSLATE_MENUITEM_ID;
		toolsTranslateMenuItem.className = "menu-type-library";
		toolsTranslateMenuItem.setAttribute("label", "题名翻译（DeepSeek）...");
		toolsTranslateMenuItem.addEventListener("command", onTranslateCommand);
		toolsPopup.appendChild(toolsTranslateMenuItem);
	}
	if (toolsPopup && !document.getElementById(TOOLS_CONFIG_MENUITEM_ID)) {
		toolsConfigMenuItem = this._createMenuItem(document);
		toolsConfigMenuItem.id = TOOLS_CONFIG_MENUITEM_ID;
		toolsConfigMenuItem.className = "menu-type-library";
		toolsConfigMenuItem.setAttribute("label", "配置 DeepSeek 题名翻译...");
		toolsConfigMenuItem.addEventListener("command", onConfigCommand);
		toolsPopup.appendChild(toolsConfigMenuItem);
	}

	let contextMenuItem = null;
	let contextTranslateMenuItem = null;
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

		contextTranslateMenuItem = this._createMenuItem(document);
		contextTranslateMenuItem.id = CONTEXT_TRANSLATE_MENUITEM_ID;
		contextTranslateMenuItem.setAttribute("label", "题名翻译（DeepSeek）...");
		contextTranslateMenuItem.hidden = true;
		contextTranslateMenuItem.addEventListener("command", onTranslateCommand);

		onContextPopupShowing = () => {
			let hasCollection = !!this._getSelectedCollection(window);
			contextMenuItem.hidden = !hasCollection;
			contextSeparator.hidden = !hasCollection;
			contextMenuItem.disabled = !hasCollection;
			contextTranslateMenuItem.hidden = !hasCollection;
			contextTranslateMenuItem.disabled = !hasCollection;
		};
		contextPopup.addEventListener("popupshowing", onContextPopupShowing);
		contextPopup.appendChild(contextSeparator);
		contextPopup.appendChild(contextMenuItem);
		contextPopup.appendChild(contextTranslateMenuItem);
	}

	this._windowHooks.set(window, {
		onCommand,
		onTranslateCommand,
		onConfigCommand,
		onContextPopupShowing,
		toolsMenuItem,
		toolsTranslateMenuItem,
		toolsConfigMenuItem,
		contextMenuItem,
		contextTranslateMenuItem,
		contextSeparator
	});

	this._ensureNumberColumnBeforeCreator(window).catch(error => {
		log("Failed to position number column: " + this._errorText(error));
	});
	this._ensureTranslationColumnAfterTitle(window).catch(error => {
		log("Failed to position translation column: " + this._errorText(error));
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

CollectionNumberingPlugin.prototype.registerTranslationColumn = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.registerColumn) {
		log("ItemTreeManager is not available; skip translation column registration");
		return;
	}

	let registeredDataKey = Zotero.ItemTreeManager.registerColumn({
		dataKey: TRANSLATION_COLUMN_BASE_KEY,
		label: "题名翻译",
		pluginID: this.id,
		enabledTreeIDs: ["main"],
		showInColumnPicker: true,
		width: "240",
		staticWidth: false,
		zoteroPersist: ["width", "hidden", "sortDirection"],
		dataProvider: (item) => this._getStoredTranslation(item)
	});

	if (!registeredDataKey) {
		registeredDataKey = this._findRegisteredTranslationColumnDataKey();
	}
	if (!registeredDataKey) {
		log("Failed to register translation column");
		return;
	}

	this._translationColumnDataKey = registeredDataKey;
	if (Zotero.ItemTreeManager.refreshColumns) {
		Zotero.ItemTreeManager.refreshColumns();
	}
};

CollectionNumberingPlugin.prototype.unregisterTranslationColumn = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.unregisterColumn) {
		return;
	}

	let dataKey = this._translationColumnDataKey || this._findRegisteredTranslationColumnDataKey();
	if (!dataKey) {
		return;
	}

	Zotero.ItemTreeManager.unregisterColumn(dataKey);
	this._translationColumnDataKey = null;
	if (Zotero.ItemTreeManager.refreshColumns) {
		Zotero.ItemTreeManager.refreshColumns();
	}
};

CollectionNumberingPlugin.prototype._findRegisteredTranslationColumnDataKey = function () {
	if (!Zotero.ItemTreeManager || !Zotero.ItemTreeManager.getCustomColumns) {
		return null;
	}

	let columns = Zotero.ItemTreeManager.getCustomColumns("main", { pluginID: this.id }) || [];
	let expectedSuffix = "-" + TRANSLATION_COLUMN_BASE_KEY;
	let targetColumn = columns.find(column => {
		return column && typeof column.dataKey === "string" && column.dataKey.endsWith(expectedSuffix);
	});
	return targetColumn ? targetColumn.dataKey : null;
};

CollectionNumberingPlugin.prototype._ensureTranslationColumnAfterTitle = async function (window) {
	if (!this._translationColumnDataKey || !window || !window.ZoteroPane || !window.ZoteroPane.itemsView) {
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
	let translationIndex = columns.findIndex(column => column.dataKey === this._translationColumnDataKey);
	if (translationIndex === -1) {
		return;
	}

	if (columns[translationIndex].hidden) {
		itemsView.tree._columns.toggleHidden(translationIndex);
		columns = itemsView._getColumns();
		translationIndex = columns.findIndex(column => column.dataKey === this._translationColumnDataKey);
		if (translationIndex === -1) {
			return;
		}
	}

	let titleIndex = columns.findIndex(column => column.dataKey === "title");
	if (titleIndex === -1) {
		return;
	}
	let targetIndex = Math.min(titleIndex + 1, columns.length - 1);
	if (translationIndex !== targetIndex) {
		itemsView.tree._columns.setOrder(translationIndex, targetIndex);
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
	let toolsTranslateMenuItem = document.getElementById(TOOLS_TRANSLATE_MENUITEM_ID);
	if (toolsTranslateMenuItem) {
		if (hooks && hooks.onTranslateCommand) {
			toolsTranslateMenuItem.removeEventListener("command", hooks.onTranslateCommand);
		}
		toolsTranslateMenuItem.remove();
	}
	let toolsConfigMenuItem = document.getElementById(TOOLS_CONFIG_MENUITEM_ID);
	if (toolsConfigMenuItem) {
		if (hooks && hooks.onConfigCommand) {
			toolsConfigMenuItem.removeEventListener("command", hooks.onConfigCommand);
		}
		toolsConfigMenuItem.remove();
	}

	let contextMenuItem = document.getElementById(CONTEXT_MENUITEM_ID);
	if (contextMenuItem) {
		if (hooks && hooks.onCommand) {
			contextMenuItem.removeEventListener("command", hooks.onCommand);
		}
		contextMenuItem.remove();
	}
	let contextTranslateMenuItem = document.getElementById(CONTEXT_TRANSLATE_MENUITEM_ID);
	if (contextTranslateMenuItem) {
		if (hooks && hooks.onTranslateCommand) {
			contextTranslateMenuItem.removeEventListener("command", hooks.onTranslateCommand);
		}
		contextTranslateMenuItem.remove();
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
			this._refreshAllItemsViews();
			this._showSummary(window, selectedCollection, options, result);
	}
	catch (error) {
		this._showErrorWindow(window, "执行文献编号失败", error);
	}
};

CollectionNumberingPlugin.prototype.runTranslateFromWindow = async function (window) {
	try {
		let selectedCollection = this._getSelectedCollection(window);
		if (!selectedCollection) {
			Services.prompt.alert(window, ADDON_NAME, "请先在左侧面板选择一个分类。");
			return;
		}

		let translateOptions = this._promptTranslateOptions(window, selectedCollection);
		if (!translateOptions) {
			return;
		}

		let apiSettings = this._readDeepSeekSettings();
		if (!apiSettings.apiKey) {
			let configured = this.openConfigFromWindow(window, true);
			if (!configured) {
				return;
			}
			apiSettings = configured;
		}

			let result = await this._translateEnglishTitles(selectedCollection, translateOptions, apiSettings);
			this._refreshAllItemsViews();
			this._showTranslateSummary(window, selectedCollection, translateOptions, apiSettings, result);
	}
	catch (error) {
		this._showErrorWindow(window, "执行题名翻译失败", error);
	}
};

CollectionNumberingPlugin.prototype.openConfigFromWindow = function (window, silent = false) {
	let current = this._readDeepSeekSettings();
	this.openPreferences(window);
	if (!silent) {
		Services.prompt.alert(
			window,
			ADDON_NAME,
			"已打开 Zotero 设置页，请在“分类文献编号”中填写 DeepSeek API 参数。"
		);
	}
	return current.apiKey ? current : null;
};

CollectionNumberingPlugin.prototype.openPreferences = function (window) {
	this.registerPreferencePane();

	if (
		Zotero.Utilities &&
		Zotero.Utilities.Internal &&
		typeof Zotero.Utilities.Internal.openPreferences === "function"
	) {
		Zotero.Utilities.Internal.openPreferences(this.preferencePaneKey);
		return;
	}

	let win = window || Services.wm.getMostRecentWindow("navigator:browser");
	if (win && typeof win.openDialog === "function") {
		win.openDialog(
			"chrome://zotero/content/preferences/preferences.xhtml",
			"zotero-prefs",
			"chrome,titlebar,centerscreen,resizable=yes",
			{ pane: this.preferencePaneKey }
		);
	}
};

CollectionNumberingPlugin.prototype.onPreferencePaneLoad = function (prefWin) {
	let doc = prefWin && prefWin.document ? prefWin.document : null;
	if (!doc) {
		return;
	}

	let apiKeyEl = doc.getElementById("collection-numbering-pref-apiKey");
	let modelEl = doc.getElementById("collection-numbering-pref-model");
	let endpointEl = doc.getElementById("collection-numbering-pref-endpoint");
	let statusEl = doc.getElementById("collection-numbering-pref-test-status");
	if (!apiKeyEl || !modelEl || !endpointEl || !statusEl) {
		return;
	}

	let settings = this._readDeepSeekSettings();
	apiKeyEl.value = settings.apiKey || "";
	modelEl.value = settings.model || DEFAULT_API_MODEL;
	endpointEl.value = settings.endpoint || DEFAULT_API_ENDPOINT;
	statusEl.value = "";
	statusEl.style.color = "";

	if (doc.__collectionNumberingPrefsBound) {
		return;
	}
	doc.__collectionNumberingPrefsBound = true;

	apiKeyEl.addEventListener("input", () => {
		this._setGlobalPref(PREF_API_KEY, (apiKeyEl.value || "").trim());
	});
	apiKeyEl.addEventListener("change", () => {
		this._setGlobalPref(PREF_API_KEY, (apiKeyEl.value || "").trim());
	});
	modelEl.addEventListener("command", () => {
		this._setGlobalPref(PREF_API_MODEL, (modelEl.value || DEFAULT_API_MODEL).trim() || DEFAULT_API_MODEL);
	});
	endpointEl.addEventListener("input", () => {
		let endpoint = (endpointEl.value || DEFAULT_API_ENDPOINT).trim() || DEFAULT_API_ENDPOINT;
		this._setGlobalPref(PREF_API_ENDPOINT, endpoint);
	});
	endpointEl.addEventListener("change", () => {
		let endpoint = (endpointEl.value || DEFAULT_API_ENDPOINT).trim() || DEFAULT_API_ENDPOINT;
		this._setGlobalPref(PREF_API_ENDPOINT, endpoint);
	});
};

CollectionNumberingPlugin.prototype.testPreferenceConnection = function (prefWin) {
	let doc = prefWin && prefWin.document ? prefWin.document : null;
	if (!doc) {
		return;
	}

	let apiKeyEl = doc.getElementById("collection-numbering-pref-apiKey");
	let modelEl = doc.getElementById("collection-numbering-pref-model");
	let endpointEl = doc.getElementById("collection-numbering-pref-endpoint");
	let testBtnEl = doc.getElementById("collection-numbering-pref-test");
	let statusEl = doc.getElementById("collection-numbering-pref-test-status");
	if (!apiKeyEl || !modelEl || !endpointEl || !testBtnEl || !statusEl) {
		return;
	}

	let apiKey = (apiKeyEl.value || "").trim();
	let model = (modelEl.value || DEFAULT_API_MODEL).trim() || DEFAULT_API_MODEL;
	let endpoint = (endpointEl.value || DEFAULT_API_ENDPOINT).trim() || DEFAULT_API_ENDPOINT;
	endpoint = endpoint.replace(/\/+$/, "");
	if (!apiKey) {
		statusEl.value = "请先输入 API Key";
		statusEl.style.color = "#b91c1c";
		return;
	}

	this._saveDeepSeekSettings({
		apiKey,
		model,
		endpoint
	});

	testBtnEl.disabled = true;
	statusEl.value = "验证中...";
	statusEl.style.color = "#6b7280";

	let xhr = new XMLHttpRequest();
	xhr.open("POST", endpoint + "/v1/chat/completions", true);
	xhr.timeout = 15000;
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.setRequestHeader("Authorization", "Bearer " + apiKey);

	xhr.onload = () => {
		testBtnEl.disabled = false;
		if (xhr.status >= 200 && xhr.status < 300) {
			statusEl.value = "连接成功";
			statusEl.style.color = "#166534";
			return;
		}
		let errText = "HTTP " + xhr.status;
		try {
			let data = JSON.parse(xhr.responseText || "{}");
			if (data && data.error && data.error.message) {
				errText += " - " + data.error.message;
			}
		}
		catch (error) {}
		statusEl.value = "连接失败：" + errText;
		statusEl.style.color = "#b91c1c";
	};

	xhr.onerror = () => {
		testBtnEl.disabled = false;
		statusEl.value = "连接失败：网络错误";
		statusEl.style.color = "#b91c1c";
	};

	xhr.ontimeout = () => {
		testBtnEl.disabled = false;
		statusEl.value = "连接失败：请求超时";
		statusEl.style.color = "#b91c1c";
	};

	xhr.send(JSON.stringify({
		model: model,
		messages: [{ role: "user", content: "请回复：ok" }],
		max_tokens: 8,
		temperature: 0,
		stream: false
	}));
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

CollectionNumberingPlugin.prototype._promptTranslateOptions = function (window, collection) {
	let includeSubcollectionsState = { value: false };
	let proceed = Services.prompt.confirmCheck(
		window,
		ADDON_NAME,
			[
				"将对所选分类执行题名翻译（仅处理英文题名）。",
				"翻译结果将写入插件专用关系字段（relations），不写入“其他(Extra)”。",
			"",
			"分类：" + this._getCollectionPath(collection),
			"",
			"仅处理包含英文字符的标题。"
		].join("\n"),
		"包含子分类",
		includeSubcollectionsState
	);
	if (!proceed) {
		return null;
	}

	let overwriteState = { value: false };
	let confirmRun = Services.prompt.confirmCheck(
		window,
		ADDON_NAME,
		[
			"是否开始执行题名翻译？",
			"",
			"若不覆盖已有翻译，则已有“题名翻译”的条目会被跳过。"
		].join("\n"),
		"覆盖已有题名翻译",
		overwriteState
	);
	if (!confirmRun) {
		return null;
	}

	return {
		includeSubcollections: includeSubcollectionsState.value,
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

CollectionNumberingPlugin.prototype._translateEnglishTitles = async function (selectedCollection, options, apiSettings) {
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

	let translatedCount = 0;
	let skippedNonEnglishCount = 0;
	let skippedExistingCount = 0;
	let failedItems = [];

	for (let i = 0; i < allItems.length; i++) {
		let item = allItems[i];
		await this._migrateLegacyTranslationData(item);
		let title = this._stringField(item, "title");
		if (!this._shouldTranslateEnglishTitle(title)) {
			skippedNonEnglishCount++;
			continue;
		}

		let existingTranslated = this._getStoredTranslation(item);
		if (existingTranslated && !options.overwriteExisting) {
			skippedExistingCount++;
			continue;
		}

		try {
			let translatedTitle = await this._translateTitleWithDeepSeek(title, apiSettings);
			await this._setStoredTranslation(item, translatedTitle);
			translatedCount++;
		}
		catch (error) {
			failedItems.push({
				id: item.id,
				title: title || "（无标题）",
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
		translatedCount,
		skippedNonEnglishCount,
		skippedExistingCount,
		failedItems
	};
};

CollectionNumberingPlugin.prototype._showTranslateSummary = function (window, selectedCollection, options, apiSettings, result) {
	let lines = [
		"题名翻译完成。",
		"",
		"分类：" + this._getCollectionPath(selectedCollection),
		"范围分类数：" + result.scopeCollectionCount,
		"扫描常规文献：" + result.totalRegularItems,
		"成功翻译：" + result.translatedCount,
		"跳过（非英文标题）：" + result.skippedNonEnglishCount,
		"跳过（已有翻译）：" + result.skippedExistingCount,
		"失败：" + result.failedItems.length,
		"",
		"规则：",
		"- 存储位置：题名翻译（插件专用 relations）",
		"- 不写入：其他(Extra)",
		"- 模型：" + apiSettings.model,
		"- 包含子分类：" + (options.includeSubcollections ? "是" : "否"),
		"- 覆盖已有题名翻译：" + (options.overwriteExisting ? "是" : "否")
	];

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

CollectionNumberingPlugin.prototype._readDeepSeekSettings = function () {
	return {
		apiKey: this._getGlobalPref(PREF_API_KEY, ""),
		model: this._getGlobalPref(PREF_API_MODEL, DEFAULT_API_MODEL),
		endpoint: this._getGlobalPref(PREF_API_ENDPOINT, DEFAULT_API_ENDPOINT)
	};
};

CollectionNumberingPlugin.prototype._saveDeepSeekSettings = function (settings) {
	this._setGlobalPref(PREF_API_KEY, settings.apiKey || "");
	this._setGlobalPref(PREF_API_MODEL, settings.model || DEFAULT_API_MODEL);
	this._setGlobalPref(PREF_API_ENDPOINT, settings.endpoint || DEFAULT_API_ENDPOINT);
};

CollectionNumberingPlugin.prototype._getGlobalPref = function (key, fallbackValue) {
	let fullKey = PREF_PREFIX + key;
	let value = null;
	try {
		value = Zotero.Prefs.get(fullKey, true);
	}
	catch (error) {}

	if (value !== null && value !== undefined && String(value) !== "") {
		return value;
	}

	try {
		let legacyValue = Zotero.Prefs.get(fullKey);
		if (legacyValue !== null && legacyValue !== undefined && String(legacyValue) !== "") {
			Zotero.Prefs.set(fullKey, legacyValue, true);
			return legacyValue;
		}
	}
	catch (error) {}

	return fallbackValue;
};

CollectionNumberingPlugin.prototype._setGlobalPref = function (key, value) {
	Zotero.Prefs.set(PREF_PREFIX + key, value, true);
};

CollectionNumberingPlugin.prototype._translateTitleWithDeepSeek = async function (title, apiSettings) {
	let endpoint = (apiSettings.endpoint || DEFAULT_API_ENDPOINT).trim().replace(/\/+$/, "");
	let model = (apiSettings.model || DEFAULT_API_MODEL).trim() || DEFAULT_API_MODEL;
	let apiKey = (apiSettings.apiKey || "").trim();
	if (!apiKey) {
		throw new Error("DeepSeek API Key 不能为空，请先配置。");
	}

	let body = {
		model,
		messages: [
			{
				role: "system",
				content: "你是学术翻译助手。请将英文论文标题翻译成中文，要求专业、准确、简洁。只输出翻译后的中文标题，不要解释。"
			},
			{
				role: "user",
				content: "英文标题：" + title
			}
		],
		max_tokens: 256,
		temperature: 0.1,
		stream: false
	};

	let parsed = await this._requestDeepSeekCompletion(endpoint, apiKey, body);
	let translated = this._extractDeepSeekText(parsed);

	if (!translated && model === "deepseek-reasoner") {
		let fallbackBody = Object.assign({}, body, { model: "deepseek-chat" });
		parsed = await this._requestDeepSeekCompletion(endpoint, apiKey, fallbackBody);
		translated = this._extractDeepSeekText(parsed);
	}

	translated = (translated || "").replace(/^["“”']+|["“”']+$/g, "").trim();
	if (!translated) {
		throw new Error("DeepSeek API 返回内容为空，无法生成翻译。");
	}
	return translated;
};

CollectionNumberingPlugin.prototype._requestDeepSeekCompletion = function (endpoint, apiKey, body) {
	let url = endpoint + "/v1/chat/completions";
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();
		xhr.open("POST", url, true);
		xhr.timeout = TRANSLATE_TIMEOUT_MS;
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.setRequestHeader("Authorization", "Bearer " + apiKey);

		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText || "{}"));
				}
				catch (error) {
					reject(new Error("DeepSeek 响应解析失败：" + error.message));
				}
				return;
			}

			let errorMessage = xhr.statusText || "请求失败";
			try {
				let parsedError = JSON.parse(xhr.responseText || "{}");
				if (parsedError && parsedError.error) {
					if (typeof parsedError.error === "string") {
						errorMessage = parsedError.error;
					}
					else if (parsedError.error.message) {
						errorMessage = parsedError.error.message;
					}
				}
			}
			catch (error) {
				if (xhr.responseText) {
					errorMessage = xhr.responseText;
				}
			}

			reject(new Error("DeepSeek 请求失败（状态码 " + xhr.status + "）：" + errorMessage));
		};

		xhr.onerror = function () {
			reject(new Error("DeepSeek 请求失败（状态码 0）：网络错误"));
		};

		xhr.ontimeout = function () {
			reject(new Error("DeepSeek 请求失败（状态码 0）：请求超时（" + (TRANSLATE_TIMEOUT_MS / 1000) + "秒）"));
		};

		xhr.send(JSON.stringify(body));
	});
};

CollectionNumberingPlugin.prototype._extractDeepSeekText = function (parsed) {
	if (!parsed || !parsed.choices || !parsed.choices.length) {
		return "";
	}

	let choice = parsed.choices[0] || {};
	let message = choice.message || {};
	let candidates = [
		this._extractTextValue(message.content),
		this._extractTextValue(choice.text),
		this._extractTextValue(message.reasoning_content),
		this._extractTextValue(parsed.output_text)
	];

	for (let candidate of candidates) {
		let normalized = this._normalizeTranslatedText(candidate);
		if (normalized) {
			return normalized;
		}
	}

	return "";
};

CollectionNumberingPlugin.prototype._extractTextValue = function (value) {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		let parts = [];
		for (let part of value) {
			if (!part) {
				continue;
			}
			if (typeof part === "string") {
				parts.push(part);
			}
			else if (typeof part.text === "string") {
				parts.push(part.text);
			}
		}
		return parts.join("\n");
	}
	if (typeof value === "object" && typeof value.text === "string") {
		return value.text;
	}
	return String(value);
};

CollectionNumberingPlugin.prototype._normalizeTranslatedText = function (text) {
	if (!text) {
		return "";
	}

	let normalized = String(text)
		.replace(/\r/g, "\n")
		.replace(/<think>[\s\S]*?<\/think>/gi, "\n")
		.replace(/```[\s\S]*?```/g, " ")
		.trim();

	if (!normalized) {
		return "";
	}

	let lines = normalized
		.split("\n")
		.map(line => line.trim().replace(/^[-*•\d\.\)\(]+\s*/, ""))
		.filter(Boolean);

	return lines.length ? lines[0] : normalized;
};

CollectionNumberingPlugin.prototype._shouldTranslateEnglishTitle = function (title) {
	let text = (title || "").trim();
	if (!text) {
		return false;
	}
	let hasLatin = /[A-Za-z]/.test(text);
	let hasCJK = /[\u3400-\u9FFF]/.test(text);
	return hasLatin && !hasCJK;
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
	return this._getExtraKeyValue(item, EXTRA_NUMBER_KEY);
};

CollectionNumberingPlugin.prototype._setStoredNumber = function (item, value) {
	this._setExtraKeyValue(item, EXTRA_NUMBER_KEY, value);
};

CollectionNumberingPlugin.prototype._getStoredTranslation = function (item) {
	let relationValue = this._getTranslationRelationValue(item);
	if (relationValue) {
		return relationValue;
	}

	let noteItem = this._findTranslationNoteItem(item);
	if (noteItem) {
		return this._extractTranslationText(noteItem.getNote());
	}

	return this._getExtraKeyValue(item, LEGACY_TRANSLATION_EXTRA_KEY);
};

CollectionNumberingPlugin.prototype._setStoredTranslation = async function (item, translatedTitle) {
	let normalized = (translatedTitle || "").trim();
	if (!normalized || !item) {
		return;
	}

	if (!this._setTranslationRelationValue(item, normalized)) {
		throw new Error("当前 Zotero 版本不支持题名翻译存储。");
	}
	await item.saveTx();
};

CollectionNumberingPlugin.prototype._getTranslationRelationValue = function (item) {
	let relationObjects = this._getTranslationRelationObjects(item);
	for (let objectValue of relationObjects) {
		let decoded = this._decodeTranslationRelationObject(objectValue);
		if (decoded) {
			return decoded;
		}
	}
	return "";
};

CollectionNumberingPlugin.prototype._setTranslationRelationValue = function (item, translatedTitle) {
	let objectValue = this._encodeTranslationRelationObject(translatedTitle);
	if (!objectValue || !item) {
		return false;
	}

	if (
		typeof item.getRelationsByPredicate === "function" &&
		typeof item.removeRelation === "function" &&
		typeof item.addRelation === "function"
	) {
		let existing = item.getRelationsByPredicate(TRANSLATION_RELATION_PREDICATE) || [];
		if (!Array.isArray(existing)) {
			existing = [existing];
		}
		for (let relationObject of existing) {
			if (relationObject !== null && relationObject !== undefined && relationObject !== "") {
				item.removeRelation(TRANSLATION_RELATION_PREDICATE, relationObject);
			}
		}
		item.addRelation(TRANSLATION_RELATION_PREDICATE, objectValue);
		return true;
	}

	if (
		typeof item.getRelations === "function" &&
		typeof item.setRelations === "function"
	) {
		let relations = item.getRelations() || {};
		relations[TRANSLATION_RELATION_PREDICATE] = [objectValue];
		item.setRelations(relations);
		return true;
	}

	return false;
};

CollectionNumberingPlugin.prototype._getTranslationRelationObjects = function (item) {
	if (!item) {
		return [];
	}

	if (typeof item.getRelationsByPredicate === "function") {
		let values = item.getRelationsByPredicate(TRANSLATION_RELATION_PREDICATE) || [];
		if (!Array.isArray(values)) {
			values = [values];
		}
		return values.filter(value => value !== null && value !== undefined && value !== "");
	}

	if (typeof item.getRelations === "function") {
		let relations = item.getRelations() || {};
		let values = relations[TRANSLATION_RELATION_PREDICATE] || [];
		if (!Array.isArray(values)) {
			values = [values];
		}
		return values.filter(value => value !== null && value !== undefined && value !== "");
	}

	return [];
};

CollectionNumberingPlugin.prototype._encodeTranslationRelationObject = function (translatedTitle) {
	let normalized = (translatedTitle || "").trim();
	if (!normalized) {
		return "";
	}
	return TRANSLATION_RELATION_VALUE_PREFIX + encodeURIComponent(normalized);
};

CollectionNumberingPlugin.prototype._decodeTranslationRelationObject = function (objectValue) {
	let raw = (objectValue || "").trim();
	if (!raw) {
		return "";
	}

	if (!raw.startsWith(TRANSLATION_RELATION_VALUE_PREFIX)) {
		return raw;
	}

	try {
		return decodeURIComponent(raw.slice(TRANSLATION_RELATION_VALUE_PREFIX.length)).trim();
	}
	catch (error) {
		return raw.slice(TRANSLATION_RELATION_VALUE_PREFIX.length).trim();
	}
};

CollectionNumberingPlugin.prototype._migrateLegacyTranslationData = async function (item) {
	if (!item) {
		return;
	}

	let itemChanged = false;
	let existingTranslated = this._getTranslationRelationValue(item);
	let legacyValue = this._getExtraKeyValue(item, LEGACY_TRANSLATION_EXTRA_KEY);
	if (!existingTranslated && legacyValue) {
		if (this._setTranslationRelationValue(item, legacyValue)) {
			itemChanged = true;
			existingTranslated = legacyValue;
		}
	}

	let noteItem = this._findTranslationNoteItem(item);
	if (!existingTranslated && noteItem) {
		let noteValue = this._extractTranslationText(noteItem.getNote());
		if (noteValue && this._setTranslationRelationValue(item, noteValue)) {
			itemChanged = true;
			existingTranslated = noteValue;
		}
	}

	if (this._removeExtraKey(item, LEGACY_TRANSLATION_EXTRA_KEY)) {
		itemChanged = true;
	}

	if (itemChanged) {
		await item.saveTx();
	}

	if (noteItem && typeof noteItem.eraseTx === "function") {
		try {
			await noteItem.eraseTx();
		}
		catch (error) {
			log("Failed to remove legacy translation note: " + this._errorText(error));
		}
	}
};

CollectionNumberingPlugin.prototype._findTranslationNoteItem = function (item) {
	if (!item || !item.getNotes) {
		return null;
	}

	let noteIDs = item.getNotes() || [];
	for (let noteID of noteIDs) {
		let noteItem = Zotero.Items.get(noteID);
		if (!noteItem || !noteItem.isNote || !noteItem.isNote()) {
			continue;
		}
		let noteHTML = noteItem.getNote() || "";
		if (noteHTML.includes("<!--" + TRANSLATION_NOTE_MARKER + "-->")) {
			return noteItem;
		}
	}
	return null;
};

CollectionNumberingPlugin.prototype._extractTranslationText = function (noteHTML) {
	if (!noteHTML) {
		return "";
	}

	let normalized = String(noteHTML)
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/\u00A0/g, " ");

	normalized = this._decodeBasicEntities(normalized)
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)
		.join(" ")
		.trim();

	return normalized;
};

CollectionNumberingPlugin.prototype._decodeBasicEntities = function (text) {
	return String(text || "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
};

CollectionNumberingPlugin.prototype._getExtraKeyValue = function (item, key) {
	let extra = this._stringField(item, "extra");
	if (!extra) {
		return "";
	}
	let keyPrefix = (key + ":").toLowerCase();
	let lines = extra.split(/\r?\n/);
	for (let line of lines) {
		let trimmed = (line || "").trim();
		if (!trimmed) {
			continue;
		}
		if (trimmed.toLowerCase().startsWith(keyPrefix)) {
			return trimmed.slice(key.length + 1).trim();
		}
	}
	return "";
};

CollectionNumberingPlugin.prototype._removeExtraKey = function (item, key) {
	let extra = this._stringField(item, "extra");
	if (!extra) {
		return false;
	}

	let lines = extra.split(/\r?\n/);
	let keyPrefix = (key + ":").toLowerCase();
	let filtered = [];
	let removed = false;

	for (let line of lines) {
		let trimmed = (line || "").trim();
		if (trimmed.toLowerCase().startsWith(keyPrefix)) {
			removed = true;
			continue;
		}
		filtered.push(line);
	}

	if (!removed) {
		return false;
	}

	while (filtered.length && !filtered[filtered.length - 1].trim()) {
		filtered.pop();
	}
	item.setField("extra", filtered.join("\n"));
	return true;
};

CollectionNumberingPlugin.prototype._setExtraKeyValue = function (item, key, value) {
	let extra = this._stringField(item, "extra");
	let lines = extra ? extra.split(/\r?\n/) : [];
	let keyPrefix = (key + ":").toLowerCase();
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

	filtered.push(key + ": " + value);
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

CollectionNumberingPlugin.prototype._refreshAllItemsViews = function () {
	for (let window of Zotero.getMainWindows()) {
		if (!window || !window.ZoteroPane || !window.ZoteroPane.itemsView) {
			continue;
		}
		let itemsView = window.ZoteroPane.itemsView;
		try {
			if (typeof itemsView.refreshAndMaintainSelection === "function") {
				itemsView.refreshAndMaintainSelection();
			}
			else if (itemsView.tree && typeof itemsView.tree.invalidate === "function") {
				itemsView.tree.invalidate();
			}
		}
		catch (error) {
			log("Failed to refresh items view: " + this._errorText(error));
		}
	}
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
