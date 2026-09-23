import Foundation
import Security

// Fetch only Linksaw's item reference and access rules, never the secret bytes.
SecKeychainSetUserInteractionAllowed(false)
var item: SecKeychainItem?
let service = "Linksaw Snippets", account = "session"
let status = SecKeychainFindGenericPassword(nil, UInt32(service.utf8.count), service, UInt32(account.utf8.count), account, nil, nil, &item)
guard status == errSecSuccess, let item else { print("Item lookup status: \(status)"); exit(1) }
var access: SecAccess?
guard SecKeychainItemCopyAccess(item, &access) == errSecSuccess, let access else { exit(2) }
var list: CFArray?
guard SecAccessCopyACLList(access, &list) == errSecSuccess, let list else { exit(3) }
for acl in list as! [SecACL] {
    let auth = SecACLCopyAuthorizations(acl) as! [String]
    var apps: CFArray?, description: CFString?
    var flags = SecKeychainPromptSelector()
    let status = SecACLCopyContents(acl, &apps, &description, &flags)
    print("ACL authorizations: \(auth), status: \(status), description: \(description.map { $0 as String } ?? "none")")
    if let apps {
        for app in apps as! [SecTrustedApplication] {
            var data: CFData?
            if SecTrustedApplicationCopyData(app, &data) == errSecSuccess, let data {
                print("Trusted app: \(String(data: data as Data, encoding: .utf8) ?? "opaque requirement")")
            }
        }
    }
}
