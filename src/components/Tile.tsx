import { Link } from 'react-router-dom'

type TileProps = {
  to: string
  label: string
}

function Tile({ to, label }: TileProps) {
  return <Link to={to} style={{ display: 'block', marginBottom: '0.5rem' }}>{label}</Link>
}

export default Tile
