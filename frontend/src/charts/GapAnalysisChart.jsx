import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const GapAnalysisChart = ({ labels = [], gaps = [] }) => {
  if (!labels || labels.length === 0 || !gaps || gaps.length === 0) {
    return (
      <div className="w-full h-72 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">No competency gap data recorded</p>
        <p className="text-[11px] text-slate-400 mt-1">Competency gaps will be calculated as employee assessment results are recorded.</p>
      </div>
    );
  }

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Competency Gap (Points)',
        data: gaps,
        backgroundColor: gaps.map(val => {
          if (val > 20) return 'rgba(239, 68, 68, 0.85)'; // High Gap Red
          if (val > 10) return 'rgba(245, 158, 11, 0.85)'; // Medium Gap Amber
          if (val > 0) return 'rgba(59, 130, 246, 0.85)';  // Low Gap Blue
          return 'rgba(16, 185, 129, 0.85)';            // Strength Green
        }),
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Competency Gap: ${context.raw} Points`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 30,
        ticks: { stepSize: 5 },
        grid: { color: 'rgba(226, 232, 240, 0.6)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="w-full h-72">
      <Bar data={data} options={options} />
    </div>
  );
};

export default GapAnalysisChart;
