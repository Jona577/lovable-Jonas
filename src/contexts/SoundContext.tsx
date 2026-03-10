import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface SoundContextType {
    typingSoundEnabled: boolean;
    clickSoundEnabled: boolean;
    setTypingSoundEnabled: (val: boolean) => void;
    setClickSoundEnabled: (val: boolean) => void;
}

const SoundContext = createContext<SoundContextType>({
    typingSoundEnabled: true,
    clickSoundEnabled: true,
    setTypingSoundEnabled: () => { },
    setClickSoundEnabled: () => { },
});

export const useSoundContext = () => useContext(SoundContext);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [typingSoundEnabled, setTypingSoundEnabledState] = useState<boolean>(() => {
        const stored = localStorage.getItem('produtivity_sound_typing');
        return stored === null ? true : JSON.parse(stored);
    });

    const [clickSoundEnabled, setClickSoundEnabledState] = useState<boolean>(() => {
        const stored = localStorage.getItem('produtivity_sound_click');
        return stored === null ? true : JSON.parse(stored);
    });

    const { playTyping, playClick } = useSoundEffects();

    // Refs para acessar o estado atual dentro dos listeners (evitar closure stale)
    const typingRef = useRef(typingSoundEnabled);
    const clickRef = useRef(clickSoundEnabled);

    useEffect(() => { typingRef.current = typingSoundEnabled; }, [typingSoundEnabled]);
    useEffect(() => { clickRef.current = clickSoundEnabled; }, [clickSoundEnabled]);

    const setTypingSoundEnabled = useCallback((val: boolean) => {
        setTypingSoundEnabledState(val);
        localStorage.setItem('produtivity_sound_typing', JSON.stringify(val));
    }, []);

    const setClickSoundEnabled = useCallback((val: boolean) => {
        setClickSoundEnabledState(val);
        localStorage.setItem('produtivity_sound_click', JSON.stringify(val));
    }, []);

    // Throttle para digitação (máx. 1 som a cada 40ms)
    const lastTypingTime = useRef(0);

    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (!typingRef.current) return;
            // Ignora atalhos de sistema (Ctrl, Alt, Meta)
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // Apenas teclas que resultam em caractere ou espaço/backspace
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                const now = Date.now();
                if (now - lastTypingTime.current < 40) return;
                lastTypingTime.current = now;
                playTyping();
            }
        };

        const handleClick = (e: MouseEvent) => {
            if (!clickRef.current) return;
            const target = e.target as HTMLElement;
            // Toca o som se o clique foi em um botão, link, ou elemento clicável
            const clickable = target.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], label[for], .cursor-pointer');
            if (clickable) {
                playClick();
            }
        };

        window.addEventListener('keydown', handleKeydown, true);
        window.addEventListener('click', handleClick, true);

        return () => {
            window.removeEventListener('keydown', handleKeydown, true);
            window.removeEventListener('click', handleClick, true);
        };
    }, [playTyping, playClick]);

    return (
        <SoundContext.Provider value={{ typingSoundEnabled, clickSoundEnabled, setTypingSoundEnabled, setClickSoundEnabled }}>
            {children}
        </SoundContext.Provider>
    );
};
