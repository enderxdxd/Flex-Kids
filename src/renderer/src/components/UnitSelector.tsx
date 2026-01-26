import React from 'react';
import { useUnit } from '../contexts/UnitContext';

const UnitSelector: React.FC = () => {
  const { currentUnit, setCurrentUnit } = useUnit();

  const units = [
    { id: 'unit-1', name: 'Unidade 1' },
    { id: 'unit-2', name: 'Unidade 2' },
    { id: 'unit-3', name: 'Unidade 3' },
  ];

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Unidade Atual
      </label>
      <select
        value={currentUnit}
        onChange={(e) => setCurrentUnit(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
