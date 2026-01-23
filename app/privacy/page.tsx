export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto p-8 space-y-6">
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 23, 2026</p>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">1. Introduction</h2>
                <p>
                    Welcome to Linksaw ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data.
                    This Privacy Policy explains how we look after your personal data when you visit our website (linksaw.com) and use our services.
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">2. Data We Collect</h2>
                <p>
                    We may collect, use, store, and transfer different kinds of personal data about you which we have grouped together as follows:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Identity Data:</strong> includes first name, last name, username, or similar identifier (via Google Auth).</li>
                    <li><strong>Contact Data:</strong> includes email address.</li>
                    <li><strong>User Content:</strong> includes links, snippets, and clips you choose to save.</li>
                    <li><strong>Usage Data:</strong> includes information about how you use our website and services.</li>
                </ul>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
                <p>
                    We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>To register you as a new customer.</li>
                    <li>To provide the services you requested (Link and snippet management).</li>
                    <li>To manage our relationship with you.</li>
                    <li>To improve our website, services, marketing, and customer relationships.</li>
                </ul>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">4. Data Security</h2>
                <p>
                    We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed.
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">5. Contact Details</h2>
                <p>
                    If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p>Email: nathanpuls@gmail.com</p>
            </section>
        </div>
    )
}
