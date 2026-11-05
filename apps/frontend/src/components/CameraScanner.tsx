// §4.2: read a tag with the device camera (Code 39 tags we print, plus QR). Loaded only when used.
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Alert, Modal } from './ui';

export default function CameraScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  useEffect(() => {
    let controls: IScannerControls | undefined;
    let done = false;
    const reader = new BrowserMultiFormatReader();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera. Type the tag number instead.');
      return;
    }
    reader
      .decodeFromVideoDevice(undefined, video.current!, (result, _err, c) => {
        if (result && !done) {
          done = true;
          c.stop();
          cb.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch(() => setError('The camera could not start. Allow camera access in your browser settings, or type the tag number.'));
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);
  return (
    <Modal open onClose={onClose} title="Scan with camera">
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-[16px] bg-navy">
            <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-tag shadow-[0_0_12px_#f2c94c]" />
          </div>
          <p className="hint mt-3">Hold the tag's barcode inside the frame. It is read automatically.</p>
        </>
      )}
    </Modal>
  );
}
