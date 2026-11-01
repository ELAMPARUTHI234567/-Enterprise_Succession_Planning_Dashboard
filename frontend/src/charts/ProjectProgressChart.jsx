import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const ProjectProgressChart = ({ labels = [], dataValues = [] }) => {
  const hasData = dataValues && dataValues.some(v => v > 0);

  if (!hasData || labels.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">No project records found</p>
        <p className="text-[11px] text-slate-400 mt-1">Verified and active projects for team members will appear here.</p>
      </div>
    );
  }

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Team Projects',
        data: dataValues,
        backgroundColor: [
          'rgba(99, 102, 241, 0.85)', // In Progress - Indigo
          'rgba(16, 185, 129, 0.85)', // Completed - Emerald
          'rgba(245, 158, 11, 0.85)', // Other / On Hold - Amber
        ],
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
          label: (context) => ` Projects: ${context.raw}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, precision: 0 },
        grid: { color: 'rgba(226, 232, 240, 0.6)' }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="w-full h-64">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ProjectProgressChart;
