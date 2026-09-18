/**
 * Calcula distância em metros entre dois pontos (Haversine)
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GpsValidationResult = {
  isValid: boolean;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  status:
    | "verified"
    | "outside_radius"
    | "low_accuracy"
    | "permission_denied"
    | "unavailable";
};

/**
 * Valida GPS contra um checkpoint
 */
export function validateGps(
  scannedLat: number | null,
  scannedLng: number | null,
  accuracy: number | null,
  targetLat: number | null,
  targetLng: number | null,
  radiusMeters: number,
  maxAccuracyMeters = 50
): GpsValidationResult {
  if (scannedLat == null || scannedLng == null) {
    return {
      isValid: false,
      distanceMeters: null,
      accuracyMeters: accuracy,
      status: "unavailable",
    };
  }

  if (accuracy != null && accuracy > maxAccuracyMeters) {
    return {
      isValid: false,
      distanceMeters: null,
      accuracyMeters: accuracy,
      status: "low_accuracy",
    };
  }

  if (targetLat == null || targetLng == null) {
    // Sem coordenadas de referência: aceita se tiver precisão ok
    return {
      isValid: accuracy == null || accuracy <= maxAccuracyMeters,
      distanceMeters: null,
      accuracyMeters: accuracy,
      status:
        accuracy != null && accuracy > maxAccuracyMeters
          ? "low_accuracy"
          : "verified",
    };
  }

  const distance = haversineDistanceMeters(
    scannedLat,
    scannedLng,
    targetLat,
    targetLng
  );

  if (distance > radiusMeters) {
    return {
      isValid: false,
      distanceMeters: Math.round(distance),
      accuracyMeters: accuracy,
      status: "outside_radius",
    };
  }

  return {
    isValid: true,
    distanceMeters: Math.round(distance),
    accuracyMeters: accuracy,
    status: "verified",
  };
}

export function getCurrentPosition(
  options?: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    });
  });
}
