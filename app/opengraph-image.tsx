import { ImageResponse } from 'next/og';
import { readServerContent } from '../lib/server-content';
export const alt = 'Eric — Software Engineer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';
export default async function Image() {
  const { profile } = (await readServerContent()).data;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: 88,
        background: '#101827',
        color: '#f5f7ff',
        borderLeft: '20px solid #4665e9',
      }}
    >
      <div style={{ display: 'flex', fontSize: 38, color: '#9db4ff', marginBottom: 34 }}>
        ERIC / PORTFOLIO
      </div>
      <div style={{ display: 'flex', fontSize: 70, fontWeight: 700 }}>
        {profile.name.slice(0, 50)}
      </div>
      <div style={{ display: 'flex', fontSize: 34, marginTop: 24 }}>
        {profile.headline.slice(0, 90)}
      </div>
      <div style={{ display: 'flex', fontSize: 25, color: '#b4c1dd', marginTop: 58 }}>
        Projects · Engineering · ericisme.cloud
      </div>
    </div>,
    size,
  );
}
