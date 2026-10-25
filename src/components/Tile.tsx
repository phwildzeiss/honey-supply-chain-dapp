import { Link } from 'react-router-dom'

type TileProps = {
  to: string
  label: string
  state?: Record<string, unknown>
}

function Tile({ to, label, state }: TileProps) {
  return <Link to={to} state={state} className="tile">{label}</Link>
}

export default Tile
