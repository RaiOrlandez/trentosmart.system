/**
 * Ensures a profile image URL is valid and absolute.
 * Prioritises the pre-built absolute `profile_picture_url` from the API.
 * Falls back to constructing a URL from a relative path, or a DiceBear avatar.
 */
export const ensureImageUrl = (urlOrFile, username = 'user', absoluteUrl = null) => {
    // If a File object is passed (local preview), convert to data URL at call site instead
    if (urlOrFile instanceof File) {
        return URL.createObjectURL(urlOrFile);
    }

    // Prefer the ready-made absolute URL returned by the updated serializer
    if (absoluteUrl && absoluteUrl.startsWith('http')) {
        return absoluteUrl;
    }

    if (!urlOrFile) {
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    }

    // Already an absolute URL or base64 data
    if (urlOrFile.startsWith('http') || urlOrFile.startsWith('data:')) {
        return urlOrFile;
    }

    // Prepend backend server root for relative /media/... paths
    const apiBase = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000/api';
    const serverRoot = apiBase.replace(/\/api\/?$/, '');
    const cleanUrl = urlOrFile.startsWith('/') ? urlOrFile : `/${urlOrFile}`;
    return `${serverRoot}${cleanUrl}`;
};
