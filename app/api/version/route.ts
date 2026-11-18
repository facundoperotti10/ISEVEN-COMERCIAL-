// Versión publicada de la app: la usa el aviso "Hay una versión nueva" para
// saber cuándo se subió un cambio y ofrecer actualizar.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { v: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'local' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
