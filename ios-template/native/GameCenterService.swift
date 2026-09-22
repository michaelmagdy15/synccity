import Foundation
import GameKit
import UIKit

/// Local Game Center authentication only. Never treat its display data as a server credential.
final class GameCenterService {
    private var pending: ((Result<[String: Any], Error>) -> Void)?
    var onStatusChange: (([String: Any]) -> Void)?

    func status() -> [String: Any] {
        let player = GKLocalPlayer.local
        guard player.isAuthenticated else { return ["authenticated": false] }
        return ["authenticated": true, "gamePlayerId": player.gamePlayerID,
                "displayName": player.displayName]
    }

    func authenticate(from presenter: UIViewController,
                      completion: @escaping (Result<[String: Any], Error>) -> Void) {
        // Invoke on the main queue. Retain the handler to observe later account changes.
        guard pending == nil else {
            completion(.failure(NSError(domain: "SyncCityGameCenter", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Authentication is already in progress."])))
            return
        }
        if GKLocalPlayer.local.isAuthenticated {
            completion(.success(status()))
            return
        }
        pending = completion
        GKLocalPlayer.local.authenticateHandler = { [weak self, weak presenter] controller, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let controller = controller {
                    guard let presenter = presenter, presenter.presentedViewController == nil else {
                        self.finish(.failure(NSError(domain: "SyncCityGameCenter", code: 2,
                            userInfo: [NSLocalizedDescriptionKey: "Cannot present Game Center right now."])))
                        return
                    }
                    presenter.present(controller, animated: true)
                    return
                }
                self.onStatusChange?(self.status())
                if let error = error { self.finish(.failure(error)) }
                else { self.finish(.success(self.status())) }
            }
        }
    }

    private func finish(_ result: Result<[String: Any], Error>) {
        let completion = pending
        pending = nil
        completion?(result)
    }
}
