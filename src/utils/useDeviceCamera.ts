import { useState, useEffect, useRef, useCallback } from 'react';

export interface ConnectedCameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export function useDeviceCamera() {
  const [devices, setDevices] = useState<ConnectedCameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>('');
  const [isSupported, setIsSupported] = useState(true);

  // Check browser support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setError('Peramban ini tidak mendukung akses kamera perangkat (getUserMedia tidak tersedia).');
    }
  }, []);

  // Enumerate all physical videoinput hardware devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices
        .filter(d => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Kamera Perangkat #${index + 1}`,
          groupId: d.groupId
        }));

      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: any) {
      console.warn('Gagal membaca daftar perangkat kamera:', err);
    }
  }, [selectedDeviceId]);

  // Listen to physical hardware plug / unplug events (e.g. USB webcam attached)
  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Start camera stream from hardware device
  const startCamera = async (deviceIdToUse?: string) => {
    setError(null);
    const targetDeviceId = deviceIdToUse || selectedDeviceId;

    try {
      // If there's an existing stream, stop tracks first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: targetDeviceId 
          ? { 
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          : {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setIsActive(true);

      // Extract resolution details
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          setResolution(`${settings.width}x${settings.height}`);
        }
        if (videoTrack.label) {
          setSelectedDeviceId(videoTrack.getSettings().deviceId || targetDeviceId);
        }
      }

      // Re-query devices so labels become visible after permission grant
      await refreshDevices();
      return newStream;
    } catch (err: any) {
      console.error('Camera connection error:', err);
      let message = 'Gagal mengakses kamera perangkat.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Izin kamera ditolak oleh pengguna atau sistem. Harap izinkan akses kamera di ikon gembok peramban.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Tidak ada perangkat kamera yang terdeteksi di laptop/komputer ini.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Kamera sedang digunakan oleh aplikasi lain (seperti Zoom, Google Meet, atau OBS). Tutup aplikasi tersebut dan coba lagi.';
      }
      setError(message);
      setIsActive(false);
      setStream(null);
      return null;
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
    setResolution('');
  };

  // Switch to another camera device
  const switchDevice = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    if (isActive) {
      await startCamera(newDeviceId);
    }
  };

  // Capture photo from video element
  const capturePhoto = (videoElement: HTMLVideoElement | null): string | null => {
    if (!videoElement || videoElement.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  return {
    isSupported,
    devices,
    selectedDeviceId,
    stream,
    isActive,
    error,
    resolution,
    activeDeviceLabel: devices.find(d => d.deviceId === selectedDeviceId)?.label || 'Kamera Utama Device',
    refreshDevices,
    startCamera,
    stopCamera,
    switchDevice,
    capturePhoto
  };
}
