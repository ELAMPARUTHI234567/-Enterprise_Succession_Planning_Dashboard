import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const CompetencyBarChart = ({ labels = [], currentScores = [], requiredScores = [] }) => {
  if (!labels || labels.length === 0 || (!currentScores.some(s => s > 0) && !requiredScores.some(s => s > 0))) {
    return (
      <div className="w-full h-72 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">No competency scores available yet</p>
        <p className="text-[11px] text-slate-400 mt-1">Competency evaluations will be plotted as assessments are completed.</p>
      </div>
    );
  }

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Current Score',
        data: currentScores,
        backgroundColor: 'rgba(99, 102, 241, 0.85)', // Indigo
        borderRadius: 6,
      },
      {
        label: 'Required Target',
        data: requiredScores,
        backgroundColor: 'rgba(203, 213, 225, 0.7)', // Slate
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: 'Inter', size: 12, weight: '500' } }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${context.raw}%`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, callback: (v) => `${v}%` },
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

export default CompetencyBarChart;
