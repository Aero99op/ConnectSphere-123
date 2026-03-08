const fs = require('fs');
const path = require('path');

const dictionariesDir = 'd:/connectsphere1/frontend/dictionaries';
const enTemplatePath = path.join(dictionariesDir, 'en.json');

console.log(`Checking template: ${enTemplatePath}`);

if (!fs.existsSync(enTemplatePath)) {
    console.error("CRITICAL: en.json not found! Check path.");
    process.exit(1);
}

const en = JSON.parse(fs.readFileSync(enTemplatePath, 'utf8'));

const langData = {
    'as': { name: 'Assamese', native: 'অসমীয়া', common: { loading: "লোডিং হৈ আছে...", success: "সফলতা!" } },
    'bn': { name: 'Bengali', native: 'বাংলা', common: { loading: "লোড হচ্ছে...", success: "সফল!" }, nav: { home: "হোম", settings: "সেটিংস" } },
    'gu': { name: 'Gujarati', native: 'ગુજરાતી', common: { loading: "લોડ થઈ રહ્યું છે...", success: "સફળતા!" } },
    'kn': { name: 'Kannada', native: 'ಕನ್ನಡ', common: { loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...", success: "ಯಶಸ್ಸು!" } },
    'ml': { name: 'Malayalam', native: 'മലയാളം', common: { loading: "লোഡുചെയ്യുന്നു...", success: "വിജയിച്ചു!" } },
    'mr': { name: 'Marathi', native: 'मराठी', common: { loading: "लोड होत आहे...", success: "यशस्वी!" } },
    'or': { name: 'Odia', native: 'ଓଡ଼ିଆ', common: { loading: "ଲୋଡ୍ ହେଉଛି...", success: "ସଫଳତା!" } },
    'pa': { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', common: { loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...", success: "ਸਫਲতা!" } },
    'ta': { name: 'Tamil', native: 'தமிழ்', common: { loading: "ஏற்றப்படுகிறது...", success: "வெற்றி!" } },
    'te': { name: 'Telugu', native: 'తెలుగు', common: { loading: "లోడ్ అవుతోంది...", success: "విజయం!" } },
    'ur': { name: 'Urdu', native: 'اردو', common: { loading: "لوڈ ہو رہا ہے...", success: "کامیابی!" } },
    'es': { name: 'Spanish', native: 'Español', common: { loading: "Cargando...", save: "Guardar", success: "¡Éxito!" }, nav: { home: "Inicio", settings: "Ajustes" } },
    'fr': { name: 'French', native: 'Français', common: { loading: "Chargement...", save: "Enregistrer", success: "Succès !" }, nav: { home: "Accueil", settings: "Paramètres" } },
    'de': { name: 'German', native: 'Deutsch', common: { loading: "Laden...", save: "Speichern", success: "Erfolg!" }, nav: { home: "Start", settings: "Einstellungen" } },
    'zh': { name: 'Chinese', native: '中文', common: { loading: "加载中...", save: "保存", success: "成功！" } },
    'ja': { name: 'Japanese', native: '日本語', common: { loading: "読み込み中...", save: "保存", success: "成功！" } },
    'ar': { name: 'Arabic', native: 'العربية', common: { loading: "جارٍ التحميل...", save: "حفظ", success: "تم بنجاح!" } },
    'ru': { name: 'Russian', native: 'Русский', common: { loading: "Загрузка...", save: "Сохранить", success: "Успех!" } },
    'pt': { name: 'Portuguese', native: 'Português', common: { loading: "Carregando...", save: "Salvar", success: "Sucesso!" } },
    'it': { name: 'Italian', native: 'Italiano', common: { loading: "Caricamento...", save: "Salva", success: "Successo!" } },
    'tr': { name: 'Turkish', native: 'Türkçe', common: { loading: "Yükleniyor...", save: "Kaydet", success: "Başarılı!" } }
};

function translateObject(source, target) {
    const result = { ...source };
    for (const key in target) {
        if (typeof target[key] === 'object' && target[key] !== null && source[key]) {
            result[key] = translateObject(source[key], target[key]);
        } else {
            result[key] = target[key];
        }
    }
    return result;
}

const allLangs = [
    'as', 'bn', 'bo', 'do', 'gu', 'kn', 'ks', 'ko', 'ma', 'ml', 'mn', 'mr', 'ne', 'or', 'pa', 'sn', 'sa', 'sd', 'ta', 'te', 'ur',
    'es', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'pt', 'it', 'tr'
];

allLangs.forEach(lang => {
    const targetFile = path.join(dictionariesDir, `${lang}.json`);
    const translated = translateObject(en, langData[lang] || {});
    fs.writeFileSync(targetFile, JSON.stringify(translated, null, 4));
    console.log(`Generated: ${targetFile}`);
});

console.log("SUCCESS: All language dictionaries generated!");
