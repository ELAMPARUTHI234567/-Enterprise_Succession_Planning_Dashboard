import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const TaskStatusChart = ({ pending = 0, inProgress = 0, completed = 0, overdue = 0 }) => {
  const total = Number(pending) + Number(inProgress) + Number(completed) + Number(overdue);

  if (total === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs font-semibold text-slate-600">No team tasks recorded</p>
        <p className="text-[11px] text-slate-400 mt-1">Create and assign tasks to view status distribution.</p>
      </div>
    );
  }

  const data = {
    labels: ['Pending', 'In Progress', 'Completed', 'Overdue'],
    datasets: [
      {
        data: [pending, inProgress, completed, overdue],
        backgroundColor: [
          'rgba(245, 158, 11, 0.85)',  // Amber
          'rgba(99, 102, 241, 0.85)',  // Indigo
          'rgba(16, 185, 129, 0.85)',  // Emerald
          'rgba(239, 68, 68, 0.85)',   // Rose Red
        ],
        borderColor: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { family: 'Inter', size: 11, weight: '500' }, usePointStyle: true, padding: 12 }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${context.raw} Tasks (${Math.round((context.raw / total) * 100)}%)`
        }
      }
    },
    cutout: '65%',
  };

  return (
    <div className="w-full h-64 flex items-center justify-center">
      <Doughnut data={data} options={options} />
    </div>
  );
};

export default TaskStatusChart;
