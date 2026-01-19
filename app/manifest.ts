import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'linksaw',
        short_name: 'linksaw',
        description: 'Your personal link and clip manager',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
            {
                src: '/logo.png',
                sizes: 'any',
                type: 'image/png',
            },
        ],
        share_target: {
            action: '/items/new',
            method: 'GET',
            params: {
                title: 'title',
                text: 'content',
                url: 'url',
            },
        } as any,
    }
}
