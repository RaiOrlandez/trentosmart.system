import React from 'react';
import { MapPin, ChevronRight, User } from 'lucide-react';

const RideCard = ({ ride, onAccept, onDecline }) => {
  return (
    <div className="glass-card p-6 rounded-[2rem] border-l-4 border-primary hover:shadow-2xl transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
            <User size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-secondary">{ride.passengerName || 'New Passenger'}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Incoming Request</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-secondary">₱{ride.fare}.00</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase">{ride.distance || 'nearby'}</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start space-x-3">
          <MapPin size={18} className="text-primary mt-1" />
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Pickup</p>
            <p className="text-sm font-medium text-slate-700">{ride.pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <ChevronRight size={18} className="text-accent mt-1" />
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Destination</p>
            <p className="text-sm font-medium text-slate-700">{ride.destAddress}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {onAccept && (
          <button
            onClick={() => onAccept(ride)}
            className="flex-1 bg-secondary text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            Accept Ride
          </button>
        )}
        {onDecline && (
          <button
            onClick={() => onDecline(ride.id)}
            className="px-6 bg-slate-100 text-slate-400 font-bold py-3 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
          >
            Decline
          </button>
        )}
      </div>
    </div>
  );
};

export default RideCard;
