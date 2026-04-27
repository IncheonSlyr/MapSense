import './globals.css'

export const metadata = {
  title: 'MapSense',
  description: 'Renewable energy recommendation dashboard.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
