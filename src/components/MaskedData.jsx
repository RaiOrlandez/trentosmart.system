import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const MaskedData = ({ value, type = 'text', fallback = 'N/A', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);

    if (!value) return <span className={`text-slate-400 italic ${className}`}>{fallback}</span>;

    const getMaskedValue = () => {
        if (type === 'email') {
            const [username, domain] = value.split('@');
            if (!domain) return value; // Invalid email
            const maskedUsername = username.length > 2 
                ? `${username.substring(0, 2)}${'*'.repeat(username.length - 2)}` 
                : `${username.substring(0, 1)}*`;
            return `${maskedUsername}@${domain}`;
        }
        
        if (type === 'phone') {
            const str = String(value);
            if (str.length <= 4) return str;
            return `${str.substring(0, 4)} ${'*'.repeat(str.length - 7)} ${str.substring(str.length - 3)}`;
        }

        // Generic text mask
        const str = String(value);
        if (str.length <= 4) return '*'.repeat(str.length);
        return `${str.substring(0, 2)}${'*'.repeat(str.length - 4)}${str.substring(str.length - 2)}`;
    };

    return (
        <span className={`inline-flex items-center gap-2 group ${className}`}>
            <span className="font-mono tracking-wider">
                {isVisible ? value : getMaskedValue()}
            </span>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsVisible(!isVisible); }}
                className="text-slate-400 hover:text-primary transition-colors opacity-50 group-hover:opacity-100 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                title={isVisible ? "Hide details" : "Reveal sensitive details"}
            >
                {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </span>
    );
};

export default MaskedData;
