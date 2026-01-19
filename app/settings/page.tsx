import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { ApiKeyManager } from "@/components/feature/ApiKeyManager"

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-4xl mx-auto py-8 px-4">
                <h1 className="text-3xl font-bold mb-8">Settings</h1>

                <div className="space-y-8">
                    {/* Profile Section */}
                    <div className="border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Profile</h2>
                        <div className="space-y-2">
                            <div>
                                <label className="text-sm text-muted-foreground">Email</label>
                                <p className="font-medium">{user.email}</p>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Username</label>
                                <p className="font-medium">@{profile?.username || 'Not set'}</p>
                            </div>
                        </div>
                    </div>

                    {/* API Key Section */}
                    <div className="border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">API Key</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Use this API key to integrate linksaw with Apple Shortcuts or other automation tools.
                        </p>
                        <ApiKeyManager initialApiKey={profile?.api_key || null} />
                    </div>

                    {/* Apple Shortcuts Instructions */}
                    <div className="border rounded-lg p-6 bg-muted/50">
                        <h2 className="text-xl font-semibold mb-4">Apple Shortcuts Setup</h2>
                        <div className="space-y-3 text-sm">
                            <p>To send your iPhone clipboard to linksaw:</p>
                            <ol className="list-decimal list-inside space-y-2 ml-2">
                                <li>Generate an API key above</li>
                                <li>Open the Shortcuts app on your iPhone</li>
                                <li>Create a new shortcut with these actions:
                                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                        <li>Get Clipboard</li>
                                        <li>Get Contents of URL:
                                            <div className="mt-1 p-2 bg-background rounded font-mono text-xs">
                                                URL: https://linksaw.com/api/clipboard<br />
                                                Method: POST<br />
                                                Headers: Authorization: Bearer [YOUR_API_KEY]<br />
                                                Request Body: JSON {`{ "content": "[Clipboard]" }`}
                                            </div>
                                        </li>
                                    </ul>
                                </li>
                                <li>Run the shortcut to save your clipboard!</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
