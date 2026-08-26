import Cocoa
import WebKit

class CoursAppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var loadingView: NSView!
    var spinner: NSProgressIndicator!
    var statusLabel: NSTextField!
    var serverProcess: Process?
    let defaultPort = 3002
    var appPort = 3002
    let projectDir = "/Users/ewilien/Documents/Code/BioMIA Revision OS"
    var isCheckingServer = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
        detectConfiguredPort()
        setupMenuBar()
        setupWindow()
        startServerAndLoad()
    }

    func detectConfiguredPort() {
        let envPath = (projectDir as NSString).appendingPathComponent(".env")
        if let content = try? String(contentsOfFile: envPath, encoding: .utf8) {
            for line in content.components(separatedBy: .newlines) {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if trimmed.hasPrefix("BIOMIA_PORT=") {
                    let val = trimmed.replacingOccurrences(of: "BIOMIA_PORT=", with: "").trimmingCharacters(in: .whitespaces)
                    if let p = Int(val), p > 0 {
                        appPort = p
                    }
                }
            }
        }
    }

    func setupMenuBar() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(NSMenuItem(title: "À propos de Cours", action: #selector(showAbout), keyEquivalent: ""))
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(NSMenuItem(title: "Masquer Cours", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h"))
        let hideOthersItem = NSMenuItem(title: "Masquer les autres", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthersItem.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthersItem)
        appMenu.addItem(NSMenuItem(title: "Tout afficher", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: ""))
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(NSMenuItem(title: "Quitter Cours", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        // Edit Menu
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Édition")
        editMenu.addItem(NSMenuItem(title: "Annuler", action: #selector(UndoManager.undo), keyEquivalent: "z"))
        let redoItem = NSMenuItem(title: "Rétablir", action: #selector(UndoManager.redo), keyEquivalent: "Z")
        editMenu.addItem(redoItem)
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(NSMenuItem(title: "Couper", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copier", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Coller", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Tout sélectionner", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        // View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "Présentation")
        viewMenu.addItem(NSMenuItem(title: "Actualiser", action: #selector(reloadPage), keyEquivalent: "r"))
        let forceReload = NSMenuItem(title: "Forcer l'actualisation", action: #selector(forceReloadPage), keyEquivalent: "R")
        viewMenu.addItem(forceReload)
        viewMenu.addItem(NSMenuItem.separator())
        let devTools = NSMenuItem(title: "Inspecter l'élément", action: #selector(toggleDevTools), keyEquivalent: "i")
        devTools.keyEquivalentModifierMask = [.command, .option]
        viewMenu.addItem(devTools)
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(NSMenuItem(title: "Activer le mode plein écran", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f"))
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Fenêtre")
        windowMenu.addItem(NSMenuItem(title: "Réduire", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"))
        windowMenu.addItem(NSMenuItem(title: "Zoomer", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: ""))
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(NSMenuItem(title: "Tout ramener au premier plan", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: ""))
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
    }

    func setupWindow() {
        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1440, height: 900)
        let winWidth = min(1380, screenSize.width - 80)
        let winHeight = min(880, screenSize.height - 80)
        let rect = NSRect(x: 0, y: 0, width: winWidth, height: winHeight)

        let styleMask: NSWindow.StyleMask = [
            .titled,
            .closable,
            .miniaturizable,
            .resizable,
            .fullSizeContentView
        ]

        window = NSWindow(contentRect: rect, styleMask: styleMask, backing: .buffered, defer: false)
        window.delegate = self
        window.center()
        window.title = "Cours"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = false
        window.backgroundColor = NSColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1.0) // #09090b
        window.minSize = NSSize(width: 960, height: 600)
        window.appearance = NSAppearance(named: .darkAqua)

        // WebView Configuration
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        config.allowsAirPlayForMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        let contentController = WKUserContentController()
        config.userContentController = contentController

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground") // Prevents white flash
        webView.alphaValue = 0.0

        // Loading view
        loadingView = NSView(frame: window.contentView!.bounds)
        loadingView.autoresizingMask = [.width, .height]
        loadingView.wantsLayer = true
        loadingView.layer?.backgroundColor = CGColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1.0)

        spinner = NSProgressIndicator(frame: NSRect(x: (winWidth - 36)/2, y: (winHeight - 36)/2 + 20, width: 36, height: 36))
        spinner.style = .spinning
        spinner.controlSize = .regular
        spinner.isDisplayedWhenStopped = false
        spinner.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        spinner.startAnimation(nil)

        statusLabel = NSTextField(frame: NSRect(x: 20, y: (winHeight - 36)/2 - 30, width: winWidth - 40, height: 24))
        statusLabel.isEditable = false
        statusLabel.isBordered = false
        statusLabel.drawsBackground = false
        statusLabel.alignment = .center
        statusLabel.textColor = NSColor(red: 0.7, green: 0.7, blue: 0.75, alpha: 1.0)
        statusLabel.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        statusLabel.stringValue = "Démarrage de Cours..."
        statusLabel.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]

        loadingView.addSubview(spinner)
        loadingView.addSubview(statusLabel)

        window.contentView?.addSubview(webView)
        window.contentView?.addSubview(loadingView)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func startServerAndLoad() {
        checkServerHealthy { [weak self] isRunning in
            guard let self = self else { return }
            if isRunning {
                self.loadWebApp()
            } else {
                self.spawnServer()
                self.waitForServerReady()
            }
        }
    }

    func checkServerHealthy(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://127.0.0.1:\(appPort)/") else {
            completion(false)
            return
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.0
        request.httpMethod = "HEAD"

        let task = URLSession.shared.dataTask(with: request) { _, response, error in
            if let http = response as? HTTPURLResponse, (200...399).contains(http.statusCode) {
                DispatchQueue.main.async { completion(true) }
            } else {
                DispatchQueue.main.async { completion(false) }
            }
        }
        task.resume()
    }

    func spawnServer() {
        DispatchQueue.main.async {
            self.statusLabel.stringValue = "Initialisation du serveur local..."
        }
        let nodeCandidates = [
            "/Users/ewilien/.local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/Users/ewilien/.hermes/node/bin/node"
        ]
        var nodePath = "/usr/local/bin/node"
        for candidate in nodeCandidates {
            if FileManager.default.fileExists(atPath: candidate) {
                nodePath = candidate
                break
            }
        }

        let startScript = (projectDir as NSString).appendingPathComponent("start.mjs")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [startScript]
        process.currentDirectoryURL = URL(fileURLWithPath: projectDir)
        var env = ProcessInfo.processInfo.environment
        env["BIOMIA_PORT"] = "\(appPort)"
        process.environment = env

        do {
            try process.run()
            self.serverProcess = process
        } catch {
            print("Failed to spawn start.mjs: \(error)")
        }
    }

    func waitForServerReady(attempt: Int = 0) {
        if attempt > 40 {
            statusLabel.stringValue = "Impossible de joindre le serveur. Cliquez sur Actualiser."
            spinner.stopAnimation(nil)
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            guard let self = self else { return }
            self.checkServerHealthy { isReady in
                if isReady {
                    self.statusLabel.stringValue = "Chargement de Cours..."
                    self.loadWebApp()
                } else {
                    self.waitForServerReady(attempt: attempt + 1)
                }
            }
        }
    }

    func loadWebApp() {
        guard let url = URL(string: "http://127.0.0.1:\(appPort)/") else { return }
        let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10.0)
        webView.load(request)
    }

    // MARK: - WKUIDelegate (Microphone & Media Capture)
    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Cours"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Cours"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Confirmer")
        alert.addButton(withTitle: "Annuler")
        alert.beginSheetModal(for: window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            self.webView.animator().alphaValue = 1.0
            self.loadingView.animator().alphaValue = 0.0
        } completionHandler: {
            self.spinner.stopAnimation(nil)
            self.loadingView.isHidden = true
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        self.loadingView.isHidden = false
        self.loadingView.alphaValue = 1.0
        self.webView.alphaValue = 0.0
        self.statusLabel.stringValue = "Connexion perdue. Tentative de reconnexion..."
        self.spinner.startAnimation(nil)
        self.waitForServerReady()
    }

    // MARK: - Actions
    @objc func reloadPage() {
        webView.reload()
    }

    @objc func forceReloadPage() {
        webView.reloadFromOrigin()
    }

    @objc func toggleDevTools() {
        // Triggers WebKit inspector if enabled
        webView.evaluateJavaScript("console.log('Cours Inspector Ready');", completionHandler: nil)
    }

    @objc func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Cours"
        alert.informativeText = "BioMIA Revision OS — Version Desktop macOS\nEnregistrement amphi, rappel actif et entraînement FSRS."
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            window.makeKeyAndOrderFront(nil)
        }
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let proc = serverProcess, proc.isRunning {
            proc.terminate()
        }
    }
}

// Entry Point
let app = NSApplication.shared
let delegate = CoursAppDelegate()
app.delegate = delegate
app.run()
