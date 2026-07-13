import Testing
import Foundation
@testable import Kairo

@Suite struct KairoContractTests {
    @Test func clientInstantiates() {
        let _ = KairoClient(baseURL: URL(string: "https://time.neima.me/api/v1")!)
    }
    @Test func clientInstantiatesStaging() {
        let _ = KairoClient(baseURL: URL(string: "https://time-staging.neima.me/api/v1")!)
    }
    @Test func generatedClientTypeExists() {
        let _ = Client.self
    }
}
