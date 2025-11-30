import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-gray-700 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-6">Página não encontrada</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
        >
          <Home size={20} />
          Voltar ao Início
        </button>
      </div>
    </div>
  );
}
