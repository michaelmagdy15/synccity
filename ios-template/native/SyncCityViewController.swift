import Capacitor

/// Instantiate this in the generated SceneDelegate in place of CAPBridgeViewController.
class SyncCityViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SyncCityGameCenterPlugin())
    }
}
