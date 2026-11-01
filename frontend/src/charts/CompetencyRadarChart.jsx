import React from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export const CompetencyRadarChart = ({ labels = [], currentScores = [], requiredScores = [], employeeName = "Employee" }) => {
  if (!labels || labels.length === 0 || (!currentScores.some(s => s > 0) && !requiredScores.some(s => s > 0))) {
    return (
      <div className="w-full h-72 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">No competency radar data recorded</p>
        <p className="text-[11px] text-slate-400 mt-1">Radar metrics will be calculated after assessment completion.</p>
      </div>
    );
  }

  const data = {
    labels: labels,
    datasets: [
      {
        label: `${employeeName} Current`,
        data: currentScores,
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
      },
      {
        label: 'Target Requirement',
        data: requiredScores,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.8)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Inter', size: 11 } }
      }
    },
    scales: {
      r: {
        angleLines: { color: 'rgba(226, 232, 240, 0.8)' },
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        suggestedMin: 40,
        suggestedMax: 100,
        ticks: { stepSize: 20 }
      }
    }
  };

  return (
    <div className="w-full h-72">
      <Radar data={data} options={options} />
    </div>
  );
};

export default CompetencyRadarChart;
