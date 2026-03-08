import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
    // Locale is provided by the middleware or dynamic route
    const resolvedLocale = locale || 'en';

    return {
        locale: resolvedLocale,
        messages: (await import(`./dictionaries/${resolvedLocale}.json`)).default
    };
});
