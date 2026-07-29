import Foundation
import Network

// MARK: - Connectivity for the offline banner.

@Observable @MainActor
final class NetworkMonitor {
    enum Status: Equatable, Sendable {
        case unknown
        case online
        case offline
    }

    private(set) var status: Status = .unknown
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "kairo.network")

    var isOnline: Bool { status == .online }
    var isOffline: Bool { status == .offline }

    init(startMonitoring: Bool = true) {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.status =
                    path.status == .satisfied ? .online : .offline
            }
        }
        if startMonitoring {
            monitor.start(queue: queue)
        }
    }

    static func didReconnect(from old: Status, to new: Status) -> Bool {
        new == .online && old != .online
    }
}
