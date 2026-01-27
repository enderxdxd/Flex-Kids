import React from 'react';
import { useUnit } from '../contexts/UnitContext';

const UnitSelector: React.FC = () => {
  const { currentUnit, setCurrentUnit, units } = useUnit();

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Unidade Atual
      </label>
      <select
        value={currentUnit}
        onChange={(e) => setCurrentUnit(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default UnitSelector;
