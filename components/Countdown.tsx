import React, { useState, useEffect } from 'react';

interface CountdownProps {
    targetDate: string;
    targetTime?: string;
}

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const Countdown: React.FC<CountdownProps> = ({ targetDate, targetTime }) => {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const dateTimeStr = targetTime ? `${targetDate}T${targetTime}` : `${targetDate}T00:00:00`;
            const targetDateTime = new Date(dateTimeStr).getTime();
            const now = new Date().getTime();
            const difference = targetDateTime - now;

            if (difference <= 0) {
                setExpired(true);
                return { days: 0, hours: 0, minutes: 0, seconds: 0 };
            }

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((difference % (1000 * 60)) / 1000)
            };
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate, targetTime]);

    if (expired) {
        return (
            <div className="text-center py-4">
                <p className="text-lg font-bold text-primary">¡El evento ha comenzado!</p>
            </div>
        );
    }

    const TimeBlock = ({ value, label }: { value: number; label: string }) => (
        <div className="flex flex-col items-center">
            <div className="bg-primary/10 dark:bg-primary/20 rounded-xl w-14 h-14 flex items-center justify-center">
                <span className="text-2xl font-black text-primary">{String(value).padStart(2, '0')}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{label}</span>
        </div>
    );

    return (
        <div className="flex justify-center gap-3">
            <TimeBlock value={timeLeft.days} label="Días" />
            <TimeBlock value={timeLeft.hours} label="Horas" />
            <TimeBlock value={timeLeft.minutes} label="Min" />
            <TimeBlock value={timeLeft.seconds} label="Seg" />
        </div>
    );
};

export default Countdown;
