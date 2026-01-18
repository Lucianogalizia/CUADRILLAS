export async function getGeo(): Promise<{lat:number; lon:number; acc:number|null}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: (pos.coords.accuracy ?? null)
      }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
