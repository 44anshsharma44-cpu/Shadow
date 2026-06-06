import { useState, useEffect, useCallback, useRef } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export function useCamera(selectedDeviceId: string = '') {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate active camera inputs
  const getDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('MediaDevices API not supported in this browser.');
      }
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 4)}`,
        }));

      setDevices(videoDevices);
    } catch (e) {
      console.warn('Enumerate devices failed:', e);
    }
  }, []);

  // Stop active camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (deviceId: string = '') => {
    stopCamera();
    setError(null);
    setIsActive(true);

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      
      // Enumerate devices again after user grants camera permission
      // to ensure we capture actual labels
      await getDevices();
    } catch (e: any) {
      console.error('Error opening camera stream:', e);
      setError(e.message || 'Could not access the webcam.');
      setIsActive(false);
      setStream(null);
    }
  }, [stopCamera, getDevices]);

  useEffect(() => {
    startCamera(selectedDeviceId);
    return () => {
      stopCamera();
    };
  }, [selectedDeviceId, startCamera, stopCamera]);

  return {
    devices,
    stream,
    error,
    isActive,
    startCamera,
    stopCamera,
    refreshDevices: getDevices,
  };
}

export default useCamera;
