import Foundation
import Network

// MARK: - Connectivity for the offline banner.

@Observable
final class NetworkMonitor {
    var isOnline = true
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "kairo.network")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in self?.isOnline = path.status == .satisfied }
        }
        monitor.start(queue: queue)
    }
}
