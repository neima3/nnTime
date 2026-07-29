import Foundation

struct NativeSyncStore {
    enum StoreError: Error {
        case invalidDocument
    }

    let fileURL: URL
    let protection: FileProtectionType = .completeUntilFirstUserAuthentication
    private let fileManager: FileManager

    init(
        directory: URL? = nil,
        fileManager: FileManager = .default
    ) {
        let root = directory ?? fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0].appending(path: "Kairo")
        fileURL = root.appending(path: "kairo-native-sync-v1.json")
        self.fileManager = fileManager
    }

    func write(_ document: NativeSyncDocument) throws {
        guard
            document.version == NativeSyncDocument.currentVersion,
            !document.scope.isEmpty
        else {
            throw StoreError.invalidDocument
        }
        try fileManager.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [.protectionKey: protection]
        )
        try JSONEncoder().encode(document).write(to: fileURL, options: [.atomic])
        try fileManager.setAttributes(
            [.protectionKey: protection],
            ofItemAtPath: fileURL.path
        )
    }

    func read(scope: String) -> NativeSyncDocument? {
        guard !scope.isEmpty else {
            return nil
        }
        guard
            let data = try? Data(contentsOf: fileURL),
            let document = try? JSONDecoder().decode(
                NativeSyncDocument.self,
                from: data
            ),
            document.version == NativeSyncDocument.currentVersion,
            document.scope == scope
        else {
            try? purge()
            return nil
        }
        return document
    }

    func purge() throws {
        guard fileManager.fileExists(atPath: fileURL.path) else {
            return
        }
        try fileManager.removeItem(at: fileURL)
    }
}
