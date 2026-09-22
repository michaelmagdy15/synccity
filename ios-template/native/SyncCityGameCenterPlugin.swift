import Capacitor
import Foundation

@objc(SyncCityGameCenterPlugin)
public class SyncCityGameCenterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SyncCityGameCenterPlugin"
    public let jsName = "SyncCityGameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]
    private let service = GameCenterService()

    public override func load() {
        service.onStatusChange = { [weak self] status in
            self?.notifyListeners("statusChanged", data: status)
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.service.status()) }
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("Native view controller is unavailable.", "NO_PRESENTER")
                return
            }
            self.service.authenticate(from: presenter) { result in
                switch result {
                case .success(let status): call.resolve(status)
                case .failure(let error): call.reject(error.localizedDescription, "AUTH_FAILED", error)
                }
            }
        }
    }
}
