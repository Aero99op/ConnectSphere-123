import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
    const resolvedLocale = locale || 'en';
    return {
        locale: resolvedLocale,
        messages: (await import(`./dictionaries/${resolvedLocale}.json`)).default
    };
});
