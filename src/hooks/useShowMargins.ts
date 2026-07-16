import { useEffect, useState } from 'react';

const KEY = 'aquablau:showMargins';
const EVENT = 'aquablau:showMargins:change';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY) === '1';
}

export function useShowMargins(): [boolean, (v: boolean) => void, () => void] {
  const [show, setShowState] = useState<boolean>(read);

  useEffect(() => {
    const handler = () => setShowState(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const setShow = (v: boolean) => {
    window.localStorage.setItem(KEY, v ? '1' : '0');
    window.dispatchEvent(new Event(EVENT));
    setShowState(v);
  };
  const toggle = () => setShow(!read());

  return [show, setShow, toggle];
}