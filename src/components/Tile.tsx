import { Link } from 'react-router-dom'

type TileProps = {
  to: string
  label: string
}

function Tile({ to, label }: TileProps) {
  return <Link to={to} className="tile">{label}</Link>
}

export default Tile
