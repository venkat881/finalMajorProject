import { useEffect, useRef, useState } from 'react';

/**
 * Camera + Image Upload capture widget.
 *
 * Features:
 * - Capture photograph using device camera
 * - Upload an image from device
 * - GPS coordinates + timestamp are permanently stamped onto the image
 * - Capture/upload is disabled until location is available
 *
 * Props:
 *   location   { lat, lng } | null
 *   onCapture(file: File)
 *   onClear()
 */
export default function CameraCapture({ location, onCapture, onClear }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [permissionState, setPermissionState] = useState('idle');
  const [previewUrl, setPreviewUrl] = useState(null);

  // Stop camera when component is removed
  useEffect(() => {
    return () => {
      stopStream();

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }
  }

  /**
   * Open device camera.
   */
  async function openCamera() {
    if (!location) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('denied');
      console.error('Camera API is not supported by this browser.');
      return;
    }

    setPermissionState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Unable to start video:', err);
        }
      }

      setPermissionState('granted');
    } catch (err) {
      console.error('Camera permission error:', err);
      setPermissionState('denied');
    }
  }

  /**
   * Draw GPS coordinates and timestamp onto image.
   */
  function stampLocation(ctx, canvasWidth, canvasHeight) {
    if (!location) return;

    const barHeight = Math.max(
      70,
      Math.round(canvasHeight * 0.12)
    );

    const fontSize = Math.max(
      14,
      Math.round(barHeight * 0.28)
    );

    // GPS information background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';

    ctx.fillRect(
      0,
      canvasHeight - barHeight,
      canvasWidth,
      barHeight
    );

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'middle';

    const coordsLine =
      `Lat: ${Number(location.lat).toFixed(6)}  ` +
      `Lng: ${Number(location.lng).toFixed(6)}`;

    const timeLine = new Date().toLocaleString();

    const padding = Math.round(barHeight * 0.18);

    ctx.fillText(
      coordsLine,
      padding,
      canvasHeight - barHeight + barHeight * 0.32
    );

    ctx.fillText(
      timeLine,
      padding,
      canvasHeight - barHeight + barHeight * 0.72
    );
  }

  /**
   * Convert an image file into a GPS-stamped JPEG.
   *
   * This is used for images selected from the device.
   */
  function stampUploadedImage(file) {
    return new Promise((resolve, reject) => {
      if (!location) {
        reject(
          new Error('Location is required before uploading an image.')
        );
        return;
      }

      const image = new Image();
      const imageUrl = URL.createObjectURL(file);

      image.onload = () => {
        try {
          const canvas = canvasRef.current;

          if (!canvas) {
            throw new Error('Canvas is not available.');
          }

          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Unable to access canvas.');
          }

          // Draw uploaded image
          ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          // Add GPS + timestamp
          stampLocation(
            ctx,
            canvas.width,
            canvas.height
          );

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(imageUrl);

              if (!blob) {
                reject(
                  new Error('Failed to process uploaded image.')
                );
                return;
              }

              const stampedFile = new File(
                [blob],
                `capture-${Date.now()}.jpg`,
                {
                  type: 'image/jpeg',
                }
              );

              resolve(stampedFile);
            },
            'image/jpeg',
            0.9
          );
        } catch (error) {
          URL.revokeObjectURL(imageUrl);
          reject(error);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);

        reject(
          new Error('Unable to read the selected image.')
        );
      };

      image.src = imageUrl;
    });
  }

  /**
   * Capture photograph from live camera.
   */
  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !location) return;

    if (!video.videoWidth || !video.videoHeight) {
      console.error('Camera video is not ready yet.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Draw camera frame
    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Add GPS + timestamp
    stampLocation(
      ctx,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        setPreviewUrl(url);

        stopStream();

        const file = new File(
          [blob],
          `capture-${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          }
        );

        onCapture(file);
      },
      'image/jpeg',
      0.9
    );
  }

  /**
   * Open the device image picker.
   */
  function openFilePicker() {
    if (!location) return;

    fileInputRef.current?.click();
  }

  /**
   * Handle image selected from device.
   */
  async function handleFileSelect(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    // Reset input so the same file can be selected again
    event.target.value = '';

    if (!location) {
      alert(
        'Please allow location access before selecting an image.'
      );
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    try {
      const stampedFile = await stampUploadedImage(file);

      const url = URL.createObjectURL(stampedFile);

      setPreviewUrl(url);

      stopStream();

      onCapture(stampedFile);
    } catch (error) {
      console.error(
        'Uploaded image processing error:',
        error
      );

      alert(
        'Unable to process the selected image. Please try another image.'
      );
    }
  }

  /**
   * Retake photograph or choose another image.
   */
  function retake() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);

    onClear?.();

    setPermissionState('idle');
  }

  return (
    <div>
      {/* Camera / Preview */}
      <div className="camera-box">

        {/* Live camera */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            display:
              !previewUrl &&
              permissionState === 'granted'
                ? 'block'
                : 'none',

            width: '100%',
            height: 'auto',
          }}
        />

        {/* Captured / uploaded image */}
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Captured civic issue"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        )}

        {/* Camera denied */}
        {!previewUrl &&
          permissionState === 'denied' && (
            <div className="camera-placeholder">
              Camera access was denied.
              <br />
              Please allow camera access in your
              browser settings and try again.
            </div>
          )}

        {/* Initial state */}
        {!previewUrl &&
          (permissionState === 'idle' ||
            permissionState === 'requesting') && (
            <div className="camera-placeholder">
              {permissionState === 'requesting'
                ? 'Requesting camera access…'
                : 'Choose an option below to add a photograph'}
            </div>
          )}
      </div>

      {/* Hidden canvas used for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {/* Hidden device image input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Controls */}
      <div
        className="camera-controls"
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >

        {/* Initial buttons */}
        {!previewUrl && (
          <>
            <button
              type="button"
              className="btn btn-accent"
              onClick={
                permissionState === 'granted'
                  ? capturePhoto
                  : openCamera
              }
              disabled={
                !location ||
                permissionState === 'requesting'
              }
            >
              {permissionState === 'granted'
                ? 'Capture Photograph'
                : permissionState === 'requesting'
                  ? 'Opening Camera…'
                  : 'Open Camera'}
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={openFilePicker}
              disabled={!location}
            >
              Upload from Device
            </button>
          </>
        )}

        {/* Retake */}
        {previewUrl && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={retake}
          >
            Retake / Choose Another
          </button>
        )}
      </div>

      {/* Location unavailable */}
      {!location && !previewUrl && (
        <p
          className="hint"
          style={{ marginTop: 8 }}
        >
          Capture and upload are disabled until your
          location is available. GPS coordinates will be
          stamped directly onto the image.
        </p>
      )}

      {/* Location available */}
      {location && !previewUrl && (
        <p
          className="hint"
          style={{ marginTop: 8 }}
        >
          GPS: {Number(location.lat).toFixed(6)},{' '}
          {Number(location.lng).toFixed(6)}
          <br />
          The GPS coordinates and timestamp will be
          stamped onto the submitted image.
        </p>
      )}
    </div>
  );
}
