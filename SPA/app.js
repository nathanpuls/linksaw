document.addEventListener('DOMContentLoaded', function () {
    const appElement = document.getElementById('app');

    function loadContent(route) {
        fetch(`views/${route}.html`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(html => {
                // Set the fetched HTML as innerHTML
                appElement.innerHTML = html;

                // Manually execute scripts within the fetched content
                const scripts = appElement.getElementsByTagName('script');
                for (let i = 0; i < scripts.length; i++) {
                    const script = document.createElement('script');
                    script.text = scripts[i].innerText;
                    document.body.appendChild(script).parentNode.removeChild(script);
                }
            })
            .catch(error => {
                console.error('Error fetching content:', error);
                window.location.hash = '#404';
                // appElement.innerHTML = '<p>404</p>';
            });
    }

    function handleNavigation() {
        const hash = window.location.hash.substring(1);
        loadContent(hash);
    }

    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('load', function () {
        if (!window.location.hash) {
            // Redirect to a default route (e.g., #/home)
            window.location.hash = '#menu';
        }
        handleNavigation();
    });
});
