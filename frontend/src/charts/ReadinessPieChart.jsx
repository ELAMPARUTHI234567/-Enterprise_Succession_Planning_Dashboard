import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export const ReadinessPieChart = ({ highCount = 5, mediumCount = 10, lowCount = 5 }) => {
  const data = {
    labels: ['High Readiness', 'Medium Readiness', 'Low Readiness'],
    datasets: [
      {
        data: [highCount, mediumCount, lowCount],
        backgroundColor: [
          'rgba(16, 185, 129, 0.85)', // Emerald Green
          'rgba(245, 158, 11, 0.85)', // Amber Yellow
          'rgba(239, 68, 68, 0.85)',  // Rose Red
        ],
        borderColor: [
          '#ffffff',
          '#ffffff',
          '#ffffff'
        ],
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
        labels: { font: { family: 'Inter', size: 12, weight: '500' }, usePointStyle: true, padding: 15 }
      },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${context.raw} Employees`
        }
      }
    },
    cutout: '65%',
  };

  return (
    <div className="w-full h-72 flex items-center justify-center">
      <Doughnut data={data} options={options} />
    </div>
  );
};

export default ReadinessPieChart;
